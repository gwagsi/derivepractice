import pandas as pd
import numpy as np
from pymongo import MongoClient
import time
import os
from numba import jit
import gc
import json

# --- 1. CONFIGURATION ---
MONGO_URI = "mongodb+srv://user:user@cluster0.gpvtzl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DATABASE_NAME = "derivfinal32"
SYMBOL = "1HZ50V"
SOURCE_COLLECTION_NAME = "1HZ50V"

# Corrected barrier percentage (0.0179% -> 0.000179)
BARRIER_PERCENTAGE = 0.000179

# High-performance processing
CHUNK_SIZE = 500000
LOOKBACK_WINDOW = 60      # 60 ticks of historical context
POST_RESET_WINDOW = 300   # 300 ticks (~5 minutes) to avoid after reset
PRE_RESET_WINDOW = 60     # 60 ticks to avoid before reset

# Output directories
SEQUENCE_DIR = "training_sequences"
os.makedirs(SEQUENCE_DIR, exist_ok=True)

# Save options
SAVE_TO_MONGO = True
FEATURES_COLLECTION_NAME = f"ml_features_{SYMBOL}_combined"

print(f"--- Enhanced Reset Event Data Preparation ---")
print(f"Symbol: {SYMBOL}, Barrier: {BARRIER_PERCENTAGE * 100:.6f}%")
print(f"Lookback Window: {LOOKBACK_WINDOW} ticks")
print(f"Post-Reset Avoidance: {POST_RESET_WINDOW} ticks")
print(f"Pre-Reset Avoidance: {PRE_RESET_WINDOW} ticks")
print(f"Processing in chunks of {CHUNK_SIZE} documents")
print(f"Save to MongoDB: {SAVE_TO_MONGO}")
print(f"-----------------------------------------\n")

# --- 2. TRAILING BARRIER FUNCTION (CORRECTED) ---


@jit(nopython=True)
def simulate_trailing_barrier_numba(price_arr, prev_price_arr, barrier_pct, initial_count):
    n = len(price_arr)
    count_out = np.zeros(n, dtype=np.int32)
    upper_barrier_out = np.zeros(n, dtype=np.float64)
    lower_barrier_out = np.zeros(n, dtype=np.float64)
    count = initial_count

    for i in range(n):
        current_price = price_arr[i]
        previous_price = prev_price_arr[i]

        if previous_price <= 0:
            count = 0
            upper_barrier = current_price * (1 + barrier_pct)
            lower_barrier = current_price * (1 - barrier_pct)
        else:
            upper_barrier_for_check = previous_price * (1 + barrier_pct)
            lower_barrier_for_check = previous_price * (1 - barrier_pct)

            if lower_barrier_for_check < current_price < upper_barrier_for_check:
                count += 1
            else:
                count = 0

            upper_barrier = current_price * (1 + barrier_pct)
            lower_barrier = current_price * (1 - barrier_pct)

        count_out[i] = count
        upper_barrier_out[i] = upper_barrier
        lower_barrier_out[i] = lower_barrier

    return count_out, upper_barrier_out, lower_barrier_out

# --- 3. ENHANCED SEQUENCE GENERATION FUNCTION ---


def create_sequences(data, window_size, feature_columns):
    sequences = []
    targets = []
    n = len(data)

    for i in range(window_size, n):
        # Input: window_size x num_features
        seq = data[feature_columns].iloc[i-window_size:i].values

        # Target: combined avoidance status at current time step
        target = data['trading_unsafe'].iloc[i]

        sequences.append(seq)
        targets.append(target)

    return np.array(sequences), np.array(targets)

# --- 4. DATA SAVING FUNCTIONS ---


def save_master_dataset():
    """Combine all sequence chunks into reusable datasets"""
    print("\nCombining all sequences into master dataset...")

    all_X = []
    all_y = []

    # Load all chunk files
    sequence_files = [f for f in os.listdir(
        SEQUENCE_DIR) if f.endswith('.npz') and 'sequences_chunk_' in f]

    for chunk_file in sorted(sequence_files):
        data = np.load(os.path.join(SEQUENCE_DIR, chunk_file))
        all_X.append(data['X'])
        all_y.append(data['y'])

    if all_X:
        # Combine all sequences
        master_X = np.vstack(all_X)
        master_y = np.concatenate(all_y)

        # Save master dataset
        master_path = os.path.join(SEQUENCE_DIR, "master_dataset.npz")
        np.savez_compressed(master_path, X=master_X, y=master_y)
        print(
            f"Master dataset saved: {master_X.shape[0]} sequences, {master_X.shape[1]} timesteps, {master_X.shape[2]} features")

        # Save metadata
        feature_columns = [
            'price', 'log_return', 'count', 'sma_10', 'sma_50', 'sma_crossover_signal',
            'volatility_20', 'barrier_width', 'price_velocity', 'count_velocity',
            'count_acceleration', 'dist_from_upper', 'dist_from_lower',
            'volatility_cluster', 'price_range_5', 'barrier_pressure'
        ]

        metadata = {
            'total_sequences': master_X.shape[0],
            'lookback_window': LOOKBACK_WINDOW,
            'feature_columns': feature_columns,
            'positive_samples': int(np.sum(master_y)),
            'negative_samples': int(len(master_y) - np.sum(master_y)),
            'positive_ratio': float(np.sum(master_y) / len(master_y)),
            'post_reset_window': POST_RESET_WINDOW,
            'pre_reset_window': PRE_RESET_WINDOW,
            'barrier_percentage': BARRIER_PERCENTAGE
        }

        with open(os.path.join(SEQUENCE_DIR, "dataset_info.json"), 'w') as f:
            json.dump(metadata, f, indent=2)

        print(
            f"Positive samples: {metadata['positive_samples']} ({metadata['positive_ratio']*100:.1f}%)")
        print(f"Negative samples: {metadata['negative_samples']}")

        return master_X, master_y, metadata
    else:
        print("No sequence files found to combine!")
        return None, None, None


def load_training_data():
    """Load the prepared training data"""
    master_path = os.path.join(SEQUENCE_DIR, "master_dataset.npz")

    if not os.path.exists(master_path):
        print("Master dataset not found. Run prepare_training_data() first.")
        return None, None, None

    data = np.load(master_path)
    X, y = data['X'], data['y']

    # Load metadata
    metadata_path = os.path.join(SEQUENCE_DIR, "dataset_info.json")
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
    else:
        metadata = {}

    print(f"Loaded dataset: {X.shape[0]} sequences")
    print(f"Features: {X.shape[2]}, Timesteps: {X.shape[1]}")
    if 'positive_samples' in metadata:
        print(
            f"Positive samples: {metadata['positive_samples']} ({metadata['positive_ratio']*100:.1f}%)")

    return X, y, metadata

# --- 5. MAIN PROCESSING FUNCTION ---


def prepare_training_data():
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    source_collection = db[SOURCE_COLLECTION_NAME]

    total_docs = source_collection.count_documents({})
    print(f"Found {total_docs} total documents in source collection.")

    # Initialize features collection if saving to MongoDB
    if SAVE_TO_MONGO:
        features_collection = db[FEATURES_COLLECTION_NAME]
        features_collection.delete_many({})  # Clear existing data
        print(f"Initialized MongoDB collection: {FEATURES_COLLECTION_NAME}")

    # State tracking between chunks
    state = {
        'price': 0.0,
        'count': 0,
        'sma_10_above': 0  # 0=False, 1=True
    }

    processed_count = 0
    chunk_index = 0

    while processed_count < total_docs:
        chunk_start = time.time()
        print(
            f"\nProcessing chunk {chunk_index} [{processed_count}-{processed_count+CHUNK_SIZE}]")

        # Fetch data chunk
        cursor = source_collection.find({}, {"_id": 0, "epoch": 1, "price": 1}
                                        ).sort('epoch', 1).skip(processed_count).limit(CHUNK_SIZE)
        chunk_df = pd.DataFrame(list(cursor))

        if chunk_df.empty:
            print("No more documents to process.")
            break

        # --- BARRIER SIMULATION ---
        # Previous price setup
        chunk_df['prev_price'] = chunk_df['price'].shift(1)
        chunk_df.iat[0, chunk_df.columns.get_loc(
            'prev_price')] = state['price']

        # Run barrier simulation
        price_np = chunk_df['price'].to_numpy()
        prev_price_np = chunk_df['prev_price'].to_numpy()
        count_res, upper_res, lower_res = simulate_trailing_barrier_numba(
            price_np, prev_price_np, BARRIER_PERCENTAGE, state['count']
        )

        chunk_df['count'] = count_res
        chunk_df['upper_barrier'] = upper_res
        chunk_df['lower_barrier'] = lower_res

        # --- RESET EVENT DETECTION ---
        # Previous count for reset detection
        chunk_df['prev_count'] = chunk_df['count'].shift(1)
        chunk_df.iat[0, chunk_df.columns.get_loc(
            'prev_count')] = state['count']

        # Detect reset events (count drops from 1 to 0)
        chunk_df['reset_event'] = ((chunk_df['count'] == 0) &
                                   (chunk_df['prev_count'] == 1)).astype(int)

        # --- POST-RESET DANGER DETECTION ---
        chunk_df['post_reset_unsafe'] = 0
        reset_indices = chunk_df.index[chunk_df['reset_event'] == 1].tolist()

        for idx in reset_indices:
            start_idx = idx + 1
            end_idx = min(idx + POST_RESET_WINDOW, len(chunk_df)-1)
            if start_idx < len(chunk_df):
                chunk_df.loc[start_idx:end_idx, 'post_reset_unsafe'] = 1

        # --- PRE-RESET DANGER DETECTION ---
        chunk_df['pre_reset_unsafe'] = 0
        for idx in reset_indices:
            start_idx = max(idx - PRE_RESET_WINDOW, 0)  # Don't go below 0
            end_idx = idx - 1  # Up to (but not including) the reset tick
            if start_idx <= end_idx:
                chunk_df.loc[start_idx:end_idx, 'pre_reset_unsafe'] = 1

        # --- COMBINE DANGER PERIODS ---
        chunk_df['trading_unsafe'] = ((chunk_df['post_reset_unsafe'] == 1) |
                                      (chunk_df['pre_reset_unsafe'] == 1)).astype(int)

        # --- ENHANCED FEATURE ENGINEERING ---
        # 1. Basic technical indicators
        chunk_df['log_return'] = np.log(
            chunk_df['price'] / chunk_df['prev_price'])
        chunk_df['sma_10'] = chunk_df['price'].rolling(window=10).mean()
        chunk_df['sma_50'] = chunk_df['price'].rolling(window=50).mean()

        # 2. SMA Crossover Signal (stateful)
        chunk_df['sma_10_above'] = (
            chunk_df['sma_10'] > chunk_df['sma_50']).astype(int)
        chunk_df.iat[0, chunk_df.columns.get_loc(
            'sma_10_above')] = state['sma_10_above']
        chunk_df['prev_sma_10_above'] = chunk_df['sma_10_above'].shift(
            1).fillna(state['sma_10_above'])

        chunk_df['sma_crossover_signal'] = 0
        chunk_df.loc[(chunk_df['sma_10_above'] == 1) &
                     (chunk_df['prev_sma_10_above'] == 0), 'sma_crossover_signal'] = 1
        chunk_df.loc[(chunk_df['sma_10_above'] == 0) &
                     (chunk_df['prev_sma_10_above'] == 1), 'sma_crossover_signal'] = -1

        # 3. Barrier dynamics
        chunk_df['barrier_width'] = chunk_df['upper_barrier'] - \
            chunk_df['lower_barrier']
        chunk_df['price_velocity'] = chunk_df['price'].diff() / \
            chunk_df['price'].shift(1)
        chunk_df['count_velocity'] = chunk_df['count'].diff()
        chunk_df['dist_from_upper'] = chunk_df['upper_barrier'] - \
            chunk_df['price']
        chunk_df['dist_from_lower'] = chunk_df['price'] - \
            chunk_df['lower_barrier']

        # 4. Volatility features
        chunk_df['volatility_20'] = chunk_df['log_return'].rolling(
            window=20).std()
        vol_mean = chunk_df['volatility_20'].rolling(window=100).mean()
        chunk_df['volatility_cluster'] = (
            chunk_df['volatility_20'] > vol_mean).astype(int)

        # 5. NEW: Pre-reset predictive features
        chunk_df['count_acceleration'] = chunk_df['count_velocity'].diff()
        chunk_df['price_range_5'] = chunk_df['price'].rolling(
            5).max() - chunk_df['price'].rolling(5).min()

        # Barrier pressure: how close price is to barriers (0=at barrier, 1=center)
        barrier_width_safe = chunk_df['barrier_width'].replace(0, np.nan)
        chunk_df['barrier_pressure'] = np.minimum(
            chunk_df['dist_from_upper'] / barrier_width_safe,
            chunk_df['dist_from_lower'] / barrier_width_safe
        )
        chunk_df['barrier_pressure'].fillna(
            0.5, inplace=True)  # Fill NaN with neutral value

        # --- UPDATE STATE FOR NEXT CHUNK ---
        state['price'] = chunk_df.iloc[-1]['price']
        state['count'] = chunk_df.iloc[-1]['count']
        state['sma_10_above'] = chunk_df.iloc[-1]['sma_10_above']

        # --- SAVE TO MONGODB (OPTIONAL) ---
        if SAVE_TO_MONGO:
            # Prepare records for MongoDB
            mongo_df = chunk_df.copy()
            mongo_df.drop(columns=['prev_price', 'prev_count', 'sma_10_above', 'prev_sma_10_above'],
                          errors='ignore', inplace=True)
            mongo_df.dropna(inplace=True)

            if not mongo_df.empty:
                records = mongo_df.to_dict('records')
                features_collection.insert_many(records)
                print(f"Saved {len(records)} feature records to MongoDB")

        # --- CLEANUP & DROP NA ---
        chunk_df.drop(columns=['prev_price', 'prev_count', 'sma_10_above', 'prev_sma_10_above'],
                      errors='ignore', inplace=True)
        chunk_df.dropna(inplace=True)

        # --- SEQUENCE GENERATION ---
        feature_columns = [
            'price',
            'log_return',
            'count',
            'sma_10',
            'sma_50',
            'sma_crossover_signal',
            'volatility_20',
            'barrier_width',
            'price_velocity',
            'count_velocity',
            'count_acceleration',        # NEW
            'dist_from_upper',
            'dist_from_lower',
            'volatility_cluster',
            'price_range_5',            # NEW
            'barrier_pressure'          # NEW
        ]

        if not chunk_df.empty and len(chunk_df) > LOOKBACK_WINDOW:
            X, y = create_sequences(
                chunk_df,
                LOOKBACK_WINDOW,
                feature_columns
            )

            # Save sequences to disk
            output_path = os.path.join(
                SEQUENCE_DIR, f"sequences_chunk_{chunk_index}.npz")
            np.savez_compressed(output_path, X=X, y=y)

            # Print statistics
            positive_count = np.sum(y)
            total_count = len(y)
            print(
                f"Saved {total_count} sequences ({positive_count} positive, {positive_count/total_count*100:.1f}%) to {output_path}")
        else:
            print("Insufficient data for sequence generation in this chunk")

        # --- UPDATE COUNTERS ---
        processed_count += len(chunk_df)
        chunk_index += 1
        chunk_time = time.time() - chunk_start
        print(
            f"Chunk processed in {chunk_time:.2f}s. Total: {processed_count}/{total_docs}")

        # Memory management
        del chunk_df
        if 'X' in locals():
            del X, y
        gc.collect()

    print("\nData preparation complete!")
    print(f"Sequence files saved to: {SEQUENCE_DIR}")

    # Combine all sequences into master dataset
    master_X, master_y, metadata = save_master_dataset()

    client.close()
    return master_X, master_y, metadata

# --- 6. CONVENIENCE FUNCTIONS ---


def quick_train_test_split(test_size=0.2, random_state=42):
    """Quick train/test split of the master dataset"""
    X, y, metadata = load_training_data()
    if X is None:
        return None, None, None, None, None

    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    print(f"Train: {len(X_train)} samples, Test: {len(X_test)} samples")
    print(
        f"Train positive: {np.sum(y_train)} ({np.sum(y_train)/len(y_train)*100:.1f}%)")
    print(
        f"Test positive: {np.sum(y_test)} ({np.sum(y_test)/len(y_test)*100:.1f}%)")

    return X_train, X_test, y_train, y_test, metadata


def print_dataset_info():
    """Print information about the prepared dataset"""
    metadata_path = os.path.join(SEQUENCE_DIR, "dataset_info.json")
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        print("=== Dataset Information ===")
        print(f"Total sequences: {metadata['total_sequences']:,}")
        print(f"Lookback window: {metadata['lookback_window']} ticks")
        print(f"Features: {len(metadata['feature_columns'])}")
        print(
            f"Positive samples: {metadata['positive_samples']:,} ({metadata['positive_ratio']*100:.1f}%)")
        print(f"Negative samples: {metadata['negative_samples']:,}")
        print(f"Post-reset window: {metadata['post_reset_window']} ticks")
        print(f"Pre-reset window: {metadata['pre_reset_window']} ticks")
        print(f"Barrier percentage: {metadata['barrier_percentage']*100:.6f}%")
        print("\nFeatures:")
        for i, feature in enumerate(metadata['feature_columns'], 1):
            print(f"  {i:2d}. {feature}")
    else:
        print("Dataset info not found. Run prepare_training_data() first.")


if __name__ == "__main__":
    # Run the complete pipeline
    print("Starting enhanced ML training data preparation...")
    master_X, master_y, metadata = prepare_training_data()

    if master_X is not None:
        print("\n" + "="*50)
        print_dataset_info()
        print("\nReady for model training!")
        print("\nUsage examples:")
        print("  X, y, info = load_training_data()")
        print("  X_train, X_test, y_train, y_test, info = quick_train_test_split()")
    else:
        print("Data preparation failed!")

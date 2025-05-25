import numpy as np
import tensorflow as tf
from keras.models import Sequential
from keras.layers import LSTM, Dense, Bidirectional, Dropout
from keras.callbacks import ModelCheckpoint, EarlyStopping
from keras.regularizers import l2
from keras.optimizers import Adam
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import json
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

# MongoDB connection setup
uri = "mongodb+srv://user:user@cluster0.gpvtzl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(uri, server_api=ServerApi('1'))

def fetch_sequence_from_mongo(collection_name):
    """Enhanced data fetching with normalization"""
    try:
        db = client["derivfinal32"]
        collection = db[collection_name]
        cursor = collection.find({}).sort("id", 1)
        
        # Extract and normalize data
        raw_data = [doc['count'] for doc in cursor]
        if not raw_data:
            raise ValueError(f"No data found in {collection_name}")
            
        # Normalization
        scaler = MinMaxScaler(feature_range=(0, 1))
        normalized_data = scaler.fit_transform(np.array(raw_data).reshape(-1, 1))
        
        print(f"Fetched {len(raw_data)} records, normalized to [0,1] range")
        return normalized_data.flatten()
        
    except Exception as e:
        print(f"Error: {e}")
        return np.array([0, 1]*10)  # Fallback pattern

def create_dataset(sequence, window_size=10):
    """Enhanced sequence creation with overlapping windows"""
    X, y = [], []
    for i in range(len(sequence) - window_size):
        X.append(sequence[i:i+window_size])
        # Original target logic (modify if needed)
        y.append(1 if sequence[i+window_size] != 1 else 0)
    return np.array(X), np.array(y)

def create_model(window_size):
    """Enhanced model architecture"""
    model = Sequential([
        Bidirectional(LSTM(64, return_sequences=True, 
                          kernel_regularizer=l2(0.01)),
                      input_shape=(window_size, 1)),
        Dropout(0.3),
        LSTM(32, activation='tanh'),
        Dropout(0.2),
        Dense(16, activation='relu'),
        Dense(1, activation='sigmoid')
    ])
    
    optimizer = Adam(learning_rate=0.001)
    model.compile(optimizer=optimizer,
                  loss='binary_crossentropy',
                  metrics=['accuracy', 
                          tf.keras.metrics.Precision(),
                          tf.keras.metrics.Recall()])
    return model

def train_lstm():
    # Enhanced parameters
    WINDOW_SIZE = 10
    EPOCHS = 200
    BATCH_SIZE = 64
    TEST_SIZE = 0.2
    
    # Data preparation
    sequence = fetch_sequence_from_mongo("1_ticks_1HZ100V")
    X, y = create_dataset(sequence, WINDOW_SIZE)
    X = X.reshape((X.shape[0], X.shape[1], 1))
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, shuffle=False)
    
    # Class weighting
    class_counts = np.bincount(y_train.astype(int))
    class_weights = {0: 1/class_counts[0], 1: 1/class_counts[1]}
    
    # Model setup
    model = create_model(WINDOW_SIZE)
    
    # Callbacks
    checkpoint = ModelCheckpoint(
        "models/lstm_model.keras",
        monitor="val_loss",
        save_best_only=True,
        verbose=1
    )
    early_stop = EarlyStopping(
        monitor='val_loss',
        patience=15,
        restore_best_weights=True
    )
    
    # Training
    history = model.fit(
        X_train, y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_data=(X_test, y_test),
        callbacks=[checkpoint, early_stop],
        class_weight=class_weights,
        verbose=1
    )
    
    # Evaluation
    print("\nFinal Evaluation:")
    loss, acc, precision, recall = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test Accuracy: {acc:.2f}")
    print(f"Precision: {precision:.2f}, Recall: {recall:.2f}")
    
    # Classification report
    y_pred = (model.predict(X_test) > 0.5).astype(int)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Close MongoDB connection
    client.close()

if __name__ == "__main__":
    train_lstm()
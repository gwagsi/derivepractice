# predict_lstm.py
import numpy as np
from keras.models import load_model
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

# ── CONFIG ─────────────────────────────────────────────────────────────────────
MONGO_URI      = "mongodb+srv://user:user@cluster0.gpvtzl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME        = "derivfinal32"
COLLECTION     = "1_ticks_1HZ100V"   # <-- change this
MODEL_PATH     = "models/lstm_model.keras"  #
WINDOW_SIZE    = 10

# ── MONGO CONNECTION ────────────────────────────────────────────────────────────
client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
db     = client[DB_NAME]
col    = db[COLLECTION]

# ── DATA FETCH & PREPROCESS ─────────────────────────────────────────────────────
def fetch_raw_sequence(collection):
    """Fetches 'count' field from MongoDB sorted by 'id'."""
    cursor = collection.find({}).sort("id", 1)
    seq = [doc.get('count', 0) for doc in cursor]
    if not seq:
        raise RuntimeError(f"No documents found in {collection.name}")
    return np.array(seq, dtype=float)

def create_windows(sequence, window_size):
    """Turns 1D array into (n_samples, window_size, 1) and returns indices for mapping."""
    X, idxs = [], []
    for i in range(len(sequence) - window_size):
        X.append(sequence[i : i + window_size])
        idxs.append(i + window_size)        # index of the value being predicted
    X = np.array(X).reshape(-1, window_size, 1)
    return X, np.array(idxs)

# ── LOAD MODEL ──────────────────────────────────────────────────────────────────
model = load_model(MODEL_PATH)
print(f"Loaded model from {MODEL_PATH}")

# ── RUN PREDICTIONS ─────────────────────────────────────────────────────────────
raw_seq = fetch_raw_sequence(col)
X_windows, predict_idxs = create_windows(raw_seq, WINDOW_SIZE)

# if you scaled your training data, apply the same scaler here!
# e.g. X_windows = scaler.transform(X_windows.reshape(-1,1)).reshape(-1,WINDOW_SIZE,1)

preds = model.predict(X_windows, batch_size=32, verbose=1)
# since output activation is sigmoid, threshold at 0.5 to get binary labels:
binary_preds = (preds.flatten() >= 0.5).astype(int)

# ── OUTPUT ─────────────────────────────────────────────────────────────────────
true_labels = (raw_seq[WINDOW_SIZE:] != 1).astype(int)  # assuming count != 1 is your label
for idx, prob, pred, true in zip(predict_idxs, preds.flatten(), binary_preds, true_labels):
    result = "✅" if pred == true else "❌"
    print(f"Index {idx:6d} → P(count != 1): {prob:.3f} → Predicted: {pred} → Actual: {true} {result}")


# Optionally, map these back to your original MongoDB docs via 'id' or timestamp.

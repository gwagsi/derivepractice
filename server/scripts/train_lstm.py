# train_lstm.py
import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from tensorflow.keras.callbacks import ModelCheckpoint
from tensorflow.keras import Input

from sklearn.model_selection import train_test_split
import json
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

uri = "mongodb+srv://user:user@cluster0.gpvtzl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)



def create_dataset(sequence, window_size=10):
    X, y = [], []
    for i in range(len(sequence) - window_size):
        X.append(sequence[i:i+window_size])
        y.append(1 if sequence[i+window_size] != 1 else 0)
    return np.array(X), np.array(y)
def fetch_sequence_from_mongo(collection_name):
    """
    Fetches tick data from MongoDB and converts it to a sequence for LSTM training
    
    Args:
        collection_name (str): Name of the MongoDB collection
        
    Returns:
        numpy.ndarray: Sequence of values for LSTM training
    """
    try:
        # Connect to database
        db = client["derivfinal32"] 
        collection = db[collection_name]
        
        # Query data - adjust this based on your actual data structure
        cursor = collection.find({}).sort("id", 1)
        
        # Extract the relevant field for your sequence
        sequence = [doc.get('count', 0) for doc in cursor]
        
        if not sequence:
            raise ValueError(f"No data found in collection {collection_name}")
            
        # Convert to numpy array
        print(f"Fetched {len(sequence)} records from MongoDB collection '{collection_name}'")
        print(f"collection sized fetched: {len(sequence)}")
        return np.array(sequence)
        
    except Exception as e:
        print(f"Error fetching data from MongoDB: {e}")
        # Return a small dummy sequence if there's an error
        return np.array([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1])

def train_lstm():
    # Parameters
    WINDOW_SIZE = 10
    EPOCHS = 20
    BATCH_SIZE = 32

    # Example: Fetch data for "1_ticks_1HZ100V"
    collection_name = "1_ticks_1HZ100V"
    sequence = fetch_sequence_from_mongo(collection_name)

    # Prepare data
    X, y = create_dataset(sequence, WINDOW_SIZE)
    # LSTM input shape: [samples, time_steps, features]
    X = X.reshape((X.shape[0], X.shape[1], 1))

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False)

    # Model architecture

    model = Sequential()
    model.add(Input(shape=(WINDOW_SIZE, 1)))
    model.add(LSTM(50, activation='relu'))
    model.add(Dense(1, activation='sigmoid'))


    model.compile(optimizer='adam', loss='binary_crossentropy',
                  metrics=['accuracy'])

    # Save best model
    checkpoint = ModelCheckpoint(
        "models/lstm_model.keras",
        monitor="val_accuracy",
        save_best_only=True,
        mode="max"
    )

    # Train
    history = model.fit(
        X_train, y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_data=(X_test, y_test),
        callbacks=[checkpoint],
        verbose=1
    )

    # Evaluate
    loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
    print(f"Test Accuracy: {accuracy:.2f}")


if __name__ == "__main__":
    train_lstm()

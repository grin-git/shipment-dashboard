// src/firebase.js

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Temporary hard-coded Firebase configuration for testing
const firebaseConfig = {
  apiKey: "AIzaSyCkV8b_MCkzQVFGG2G8ryDSoW1ghNVlEmw",
  authDomain: "shipment-dashboard-ef167.firebaseapp.com",
  projectId: "shipment-dashboard-ef167",
  storageBucket: "shipment-dashboard-ef167.appspot.com",
  messagingSenderId: "464262146580",
  appId: "1:464262146580:web:8f1aa9eb5cd1e32724d501"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Auth
const auth = getAuth(app);

export { db, auth };

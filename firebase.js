import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDYMdoLuQY3eCFpj2kP1B4j82D_qQQhaA4",
  authDomain: "xceelent-amar-academy.firebaseapp.com",
  projectId: "xceelent-amar-academy",
  storageBucket: "xceelent-amar-academy.firebasestorage.app",
  messagingSenderId: "537348873180",
  appId: "1:537348873180:web:c1ed3cd8230ccec211cd19",
  measurementId: "G-3KYLNJWPGW"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


// Export everything for app.js
export {
  auth,
  db,

  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,

  onAuthStateChanged,
  signOut,

  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  deleteDoc
};
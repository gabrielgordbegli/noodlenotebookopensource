// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCHleDzzq--Qmcs_T2pnLOybHKtSLn8h8w",
  authDomain: "noodlenotebook-367718.firebaseapp.com",
  projectId: "noodlenotebook-367718",
  storageBucket: "noodlenotebook-367718.appspot.com",
  messagingSenderId: "428904343046",
  appId: "1:428904343046:web:1916697fde56f18f018587",
  measurementId: "G-CSE6SFZ0XS"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const initFirebase = () => {
  return app;
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
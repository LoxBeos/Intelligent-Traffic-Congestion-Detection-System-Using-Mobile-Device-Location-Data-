import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyD2qmh45B4lcFRMco2Z8mop1ahXsBpI_vU",
    authDomain: "mymaps-e8396.firebaseapp.com",
    databaseURL: "https://mymaps-e8396-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mymaps-e8396",
    storageBucket: "mymaps-e8396.appspot.com",
    messagingSenderId: "402277017767",
    appId: "1:402277017767:web:a12ecb3a80462bfb4c9382",
    measurementId: "G-NPD1YNKQZY"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, set, push };
import axios from 'axios';
import { API_URL } from "./config/api";

const instance = axios.create({
    baseURL: API_URL
});

// Yeh har request se pehle latest token uthayega
instance.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default instance;

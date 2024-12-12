import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer"; // 정확히 대소문자 구별
import MainContent from "./components/MainContent";
import AboutUs from "./components/aboutus";
import Dataset from "./components/dataset";
import "./App.css";

function App() {
    return (
        <Router>
            <div className="app">
                <Header />
                <Routes>
                    <Route path="/" element={<MainContent />} />
                    <Route path="/about-us" element={<AboutUs />} />
                    <Route path="/data-set" element={<Dataset />} />
                </Routes>
                <Footer />
            </div>
        </Router>
    );
}

export default App;
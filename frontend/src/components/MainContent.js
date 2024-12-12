import React from "react";
import { useNavigate } from "react-router-dom";
import "./MainContent.css";

const MainContent = () => {
    const navigate = useNavigate();

    const handleButtonClick = () => {
        navigate("/data-set");
    };
    return (
        <main className="main-content">
            <div className="content">
                <h1>동국대학교 종합 설계</h1>
                <h2>FIX BUG</h2>
                <button className="project-button" onClick={handleButtonClick}>
                SEE OUR PROJECT
                </button>
            </div>
        </main>
    );
};

export default MainContent;

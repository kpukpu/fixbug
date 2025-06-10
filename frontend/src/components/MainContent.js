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
                <h1>대전 서구 해충 민원 발생 위험지 예측</h1>
                <h2>FIXBUG</h2>
                <button className="project-button" onClick={handleButtonClick}>
                예측 결과 확인
                </button>
            </div>
        </main>
    );
};

export default MainContent;

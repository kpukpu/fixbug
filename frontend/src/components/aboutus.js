import React, {  } from "react";
import "./aboutus.css";

import headerImage from "../assets/about-us-image.png";
import teamPhoto from "../assets/team_photo.png";
import sook from "../assets/이수욱.jpg";
import kim from "../assets/김승주.jpg";
import park from "../assets/박찬혃.jpg";

const AboutUs = () => {
    return (
        <div className="about-us">
            <div className="header-image-container">
                <img src={headerImage} alt="Header Banner" className="header-image" />
            </div>

            <div className="content-container">
                <div className="text-container">
                    <h1>ABOUT US</h1>
                    <p>
                    동국대학교 종합설계 FIXBUG는 4차 산업혁명을 선도하는 기술개발을 학습하고 성장하여 인간과 기술의 융합을 실현하여 공영하는 미래사회 구축을 비전으로 삼고 있습니다. 동국대학교 컴퓨터 공학과 학도들로 구성되어 있으며 전문 기업 (주)에쓰오씨블루모델컨설팅과의 협력을 바탕으로 AI 딥러닝, 머신러닝 모델 기반 해충 민원 시간별/공간별 발생 위험도 예측 프로젝트를 진행하고 있습니다. 
                    </p>
                </div>

                <div className="image-container">
                    <img src={teamPhoto} alt="Team in a Meeting" className="team-photo" />
                </div>
            </div>
            
            <div className="content-container">
                <div className="text-container">
                    <h1>팀원 소개</h1>
                    <h1>팀장 이수욱</h1>    
                    <h2>
                    - 동국대학교 19학번<br/>- 2020 창의적 공학 설계 지름 ROAD 어플리케이션 구상 및 설계 <br/>- 2023 캡스톤 디자인 CHAT GPU 비즈니스 모델 설계 <br/>- 2024 캡스톤 디자인 케릭 캐쳐 비즈니스 모델 설계 <br/>- 2024 캡스톤 디자인 AI 활용, 서울 중구 홍보 컨텐츠 팀장 담당 <br/>- 2024 공개 SW 프로젝트 ICU 알고리즘 설계 <br/>- FIXBUG 팀장 및 Machine Learning 개발<br/>- 육군 특수전사령부 특수전학교 전술 조교 <br/>- SQLD <br/>- 정보처리기능사<br/>- 워드프로세서
                    </h2>
                </div>

                <div className="image-container">
                    <img src={sook} alt="Team in a Meeting" className="team-photo" />
                </div>
            </div>
            <div className="content-container">
                <div className="text-container">
                    <h1><br/>김승주</h1>
                    <h2>
                    - 동국대학교 19학번<br/>- 2024 제 1회 AI 소프트웨어융압학부 해커톤 CAMPUTHON Backend 개발<br/>- 2024 공개SW프로젝트 중립적 뉴스 개발 서비스 Backend 개발<br/>- 2024 ICONICTHON Backend 개발<br/>- 2024 기술창업캡스톤디자인 비콘 기반 임산부석 스마트 알림 시스템 Backend 개발<br/>- FIXBUG Backend & Frontend 개발
                    </h2>
                </div>

                <div className="image-container">
                    <img src={kim} alt="Team in a Meeting" className="team-photo" />
                </div>
            </div>
            <div className="content-container">
                <div className="text-container">
                    <h1><br/>박찬혁</h1>
                    <h2>
                    - 동국대학교 20학번<br/>- 2024 Co-끼리 (대학생 캠퍼스 네트워크 형성을 위한 익명 매칭 서비스) 개발<br/>- 2024 SeCureCoding-Shopping-Site(보안 코딩된 쇼핑 사이트) 개발<br/>- 2024 Superbase(Unity 우주게임 제작) 개발 <br/>- FIXBUG Deep Learning 개발
                    </h2>
                </div>

                <div className="image-container">
                    <img src={park} alt="Team in a Meeting" className="team-photo" />
                </div>
            </div>
        </div>
    );
};

export default AboutUs;

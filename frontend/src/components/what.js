// src/components/what.js
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './what.css';          // ← 바로 아래 CSS

import what1 from "../assets/what1.png";
import what2 from "../assets/what2.png";
import what3 from "../assets/what3.png";
import what4 from "../assets/what4.png";
import what5 from "../assets/what5.png";
import what6 from "../assets/what6.png";
import what7 from "../assets/what7.png";
import what8 from "../assets/what8.png";
import what9 from "../assets/what9.png";
import what10 from "../assets/what10.png";
import what11 from "../assets/what11.png";
import what13 from "../assets/what13.png";
import what14 from "../assets/what14.png";
import what12 from "../assets/what12.png";
import what15 from "../assets/what15.png";
import what16 from "../assets/what16.png";


export default function What() {
  return (
    <main className="what-container">

      <section className="what-gallery">
        <h1>해충 민원 데이터 요약</h1>
          <img src={what1} alt="논문 페이지 1" className="what-image" />
          <img src={what2} alt="논문 페이지 2" className="what-image" />
          <img src={what3} alt="논문 페이지 3" className="what-image" />
          <img src={what4} alt="논문 페이지 4" className="what-image" />
          <h1>년/월별 시계열 데이터 목록</h1>
          <img src={what5} alt="논문 페이지 5" className="what-image" />
          <img src={what6} alt="논문 페이지 6" className="what-image" />
          <h1>해충 종류별 민원 발생 건수</h1>
          <img src={what7} alt="논문 페이지 7" className="what-image" />
          <h1>월별 민원 발생 수 추이</h1>
          <img src={what8} alt="논문 페이지 8" className="what-image" />
          <h1>월별 민원 발생 분포(년도별)</h1>
          <img src={what9} alt="논문 페이지 9" className="what-image" />
          <img src={what10} alt="논문 페이지 10" className="what-image" />
          <h1>해충 퇴치기 설치에 따른 민원 발생 수 </h1>
          <img src={what11} alt="논문 페이지 11" className="what-image" />
          <h1>민원 발생 위치 시각화 </h1>
          <img src={what12} alt="논문 페이지 12" className="what-image" />
          <h1>민원 발생과 데이터 속성 간 스피어만 상관계수</h1>
          <img src={what13} alt="논문 페이지 13" className="what-image" />
          <img src={what14} alt="논문 페이지 14" className="what-image" />
          <img src={what15} alt="논문 페이지 15" className="what-image" />
          <img src={what16} alt="논문 페이지 16" className="what-image" />
        
      </section>
    </main>
  );
}

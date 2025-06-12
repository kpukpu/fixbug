import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Header.css";

const Header = () => {
  /* ---------- 문의 모달 ---------- */
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ───────── 헤더 ───────── */}
      <header className="header">
        {/* 왼쪽: 로고 */}
        <div className="logo">
          <Link to="/">FIXBUG</Link>
        </div>

        {/* 가운데: 내비게이션 */}
        <nav className="main-nav">
          <ul className="nav-list">
            <li><Link to="/about-us">팀원 소개</Link></li>
            {/* ▼ 드롭다운 ▼ */}
            <li className="dropdown">
              <span className="drop-btn">공간별 예측 ▾</span>
              <ul className="dropdown-menu">
                <li><Link to="/data-set">공간별 예측</Link></li>
                <li><Link to="/paper">논문</Link></li>
              </ul>
            </li>

            <li><Link to="/our-project">년/월별 예측</Link></li>
            <li><Link to="/what">예측 모델 소개</Link></li>
          </ul>
        </nav>

        {/* 오른쪽: 문의하기 버튼 */}
        <button className="contact-button" onClick={() => setOpen(true)}>
          문의하기
        </button>
      </header>

      {/* ───────── 커스텀 모달 ───────── */}
      {open && (
        <div
          className="modal-backdrop"
          onClick={() => setOpen(false)}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()} /* 내부 클릭 시 닫힘 방지 */
          >
            <h2>문의 이메일</h2>
            <p className="email">
              이수욱&nbsp; lso2288@naver.com<br />
              김승주&nbsp; daejo99@naver.com<br />
              박찬혁&nbsp; pchishahaboy@naver.com
            </p>
            <button className="close-btn" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;

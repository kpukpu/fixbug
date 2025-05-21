import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Header.css";

const Header = () => {
  // 모달 노출 여부
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="header">
        <nav>
          <ul className="nav-list">
            <li><Link to="/">FIXBUG</Link></li>
            <div>&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp;&ensp; </div>
            <li><Link to="/about-us">ABOUT US</Link></li>
            <li><Link to="/data-set">DATA SET</Link></li>
            <li><Link to="/our-project">OUR PROJECT</Link></li>
            <li><Link to="/what">WHAT</Link></li>
          </ul>
        </nav>

        {/* 문의하기 버튼 */}
        <button className="contact-button" onClick={() => setOpen(true)}>
          문의하기
        </button>
      </header>

      {/* ---------- 커스텀 모달 ---------- */}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()} /* 내부 클릭 시 닫힘 방지 */
          >
            <h2>문의 이메일</h2>
            <p className="email">sipal@dgu.ac.kr</p>
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

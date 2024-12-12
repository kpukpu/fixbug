import React from "react";
import { Link } from "react-router-dom";
import "./Header.css";

const Header = () => {
    return (
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
            <button className="login-button">로그인</button>
        </header>
    );
};

export default Header;

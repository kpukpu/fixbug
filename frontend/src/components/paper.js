import React from "react";
import "./paper.css";

// 이미지 경로는 실제 넣어둔 위치에 따라 바꿔주세요.
// 여기선 src/assets 폴더에 넣었다고 가정합니다.
import paper1 from "../assets/paper1.png";
import paper2 from "../assets/paper2.png";
import paper3 from "../assets/paper3.png";

const Paper = () => {
  return (
    <main className="paper-container">

      <section className="paper-gallery">
        <p className="paper-note">
            이 논문은 한국정보과학회에 등재되었습니다.
        </p><figure>
          <img src={paper1} alt="논문 페이지 1" className="paper-image" />
          
        </figure>

        <figure>
          <img src={paper2} alt="논문 페이지 2" className="paper-image" />
          
        </figure>

        <figure>
          <img src={paper3} alt="논문 페이지 3" className="paper-image" />
        
        </figure>
      </section>
    </main>
  );
};

export default Paper;

// src/components/what.js
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './what.css';          // ← 바로 아래 CSS

export default function What() {
  /* ===== 예시 데이터 ===== */
  const mlData = [
    { model: 'Random Forest', acc: 0.87 },
    { model: 'XGBoost',       acc: 0.91 },
    { model: 'LightGBM',      acc: 0.90 },
    { model: 'SVM',           acc: 0.82 },
  ];

  const dlData = [
    { model: 'CNN',           acc: 0.93 },
    { model: 'Bi-LSTM',       acc: 0.92 },
    { model: 'Transformer',   acc: 0.95 },
    { model: 'MLP',           acc: 0.88 },
  ];

  /* ===== ref ===== */
  const mlRef = useRef(null);
  const dlRef = useRef(null);

  /* ===== 공통 차트 렌더러 ===== */
  const drawBarChart = (el, data) => {
    const W = 420, H = 320, M = { top: 20, right: 20, bottom: 40, left: 120 };
    const svg = d3.select(el)
      .attr('width',  W)
      .attr('height', H);

    svg.selectAll('*').remove();          // 리렌더 대비 초기화

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
    const innerW = W - M.left - M.right;
    const innerH = H - M.top  - M.bottom;

    const y = d3.scaleBand()
      .domain(data.map(d => d.model))
      .range([0, innerH])
      .padding(0.15);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.acc)]).nice()
      .range([0, innerW]);

    g.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(y));

    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat(d3.format('.0%')));

    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
        .attr('class', 'bar')
        .attr('y', d => y(d.model))
        .attr('height', y.bandwidth())
        .attr('width', d => x(d.acc));

    /* 값 라벨 */
    g.selectAll('.label')
      .data(data)
      .enter()
      .append('text')
        .attr('x', d => x(d.acc) + 6)
        .attr('y', d => y(d.model) + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .text(d => d3.format('.0%')(d.acc));
  };

  /* ===== 렌더 ===== */
  useEffect(() => { drawBarChart(mlRef.current, mlData); }, []);
  useEffect(() => { drawBarChart(dlRef.current, dlData); }, []);

  return (
    <div className="main-container">
      <h1>모델 성능 비교</h1>

      <div className="content-flex">
        {/* ── 머신러닝 ── */}
        <section className="category-container">
          <h2>Machine Learning 모델</h2>
          <div className="info-box">
            <svg ref={mlRef} />
          </div>
        </section>

        {/* ── 딥러닝 ── */}
        <section className="category-container">
          <h2>Deep Learning 모델</h2>
          <div className="info-box">
            <svg ref={dlRef} />
          </div>
        </section>
      </div>
    </div>
  );
}

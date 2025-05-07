import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import './ourproject.css';

export default function OurProject() {
  const svgRef   = useRef(null);
  const chartRef = useRef(null);

  /* ===== 상수 ===== */
  const GRID = 0.001;            // 100 m
  const Z_DONG = 13;
  const Z_GRID = 15;

  /* 차트 크기 (늘렸습니다) */
  const CHART_W = 570;
  const CHART_H = 380;

  useEffect(() => {
    /* ---------- Leaflet ------------ */
    const map = L.map('map', {
      // 서구 중심 좌표 (둔산동 부근)
      center: [36.348, 127.376],
      zoom: Z_DONG,
      layers: [
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }),
      ],
    });

    /* ---------- SVG overlay -------- */
    if (!svgRef.current)
      svgRef.current = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    map.getPanes().overlayPane.appendChild(svgRef.current);
    const svg = d3
      .select(svgRef.current)
      .style('position', 'absolute')
      .style('pointer-events', 'none');

    /* ---------- 데이터 로드 -------- */
    Promise.all([
      d3.json(`${process.env.PUBLIC_URL}/data/dong.geojson`),
      d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`),
      d3.csv(`${process.env.PUBLIC_URL}/data/ssookssook.csv`),
    ]).then(([dongGeo, gridGeo, csv]) => {
      /* 유틸 */
      const snap   = ([lng, lat]) => [Math.floor(lng / GRID) * GRID, Math.floor(lat / GRID) * GRID];
      const origin = (f) => {
        const { type, coordinates: C } = f.geometry || {};
        if (type === 'Point') return C;
        if (type === 'Polygon') return C[0][0];
        if (type === 'MultiPolygon') return C[0][0][0];
        return [null, null];
      };
      const rev   = ([lng, lat]) => [lat, lng];
      const color = (a, p) => {
        if (a === 1 && p === 1) return '#00FF00';       // TP
        if (a === 1 && p === 0) return '#9b111e';       // FN
        if (a === 0 && p === 1) return '#0000FF';       // FP
        return '#ffffff';
      };

      /* CSV → valueMap */
      const val = {};
      csv.forEach(r => {
        const key = snap([+r.경도, +r.위도]).join(',');
        val[key] = { a: +r.실제값 || 0, p: +r.예측값 || 0 };
      });

      /* SVG 그룹 */
      const g          = svg.append('g');
      const dongLayer  = g.append('g');
      const gridLayer  = g.append('g').style('display', 'none');

      /* 투영 */
      const geoPath = d3.geoPath().projection(
        d3.geoTransform({
          point(x, y) {
            const p = map.latLngToLayerPoint([y, x]);
            // @ts-ignore
            this.stream.point(p.x, p.y);
          },
        }),
      );

      /* ------------------ 행정동 경계 ------------------ */
      dongLayer
        .selectAll('path')
        .data(dongGeo.features)
        .enter()
        .append('path')
        .attr('fill', '#b1b4e2')
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .style('pointer-events', 'all')
        .on('mouseover', function () { d3.select(this).attr('fill', '#d3d3d3'); })
        .on('mouseout',  function () { d3.select(this).attr('fill', '#b1b4e2'); })
        .on('click', function (e, dongF) {
          /* 1) 지도 확대 */
          const [lng, lat] = d3.geoCentroid(dongF);
          map.setView([lat, lng], Z_GRID);

          /* 2) 클릭한 행정동 숨김 */
          d3.select(this).style('display', 'none');

          /* 3) 격자 레이어 구성 */
          gridLayer.selectAll('*').remove();
          gridLayer.style('display', 'block');

          const inside = gridGeo.features.filter(f =>
            d3.geoContains(dongF, d3.geoCentroid(f))
          );

          let tp = 0, fn = 0, fp = 0;

          gridLayer
            .selectAll('rect')
            .data(inside)
            .enter()
            .append('rect')
            .attr('stroke', '#000')
            .attr('stroke-width', 0.1)
            .attr('fill', f => {
              const k = snap(origin(f)).join(',');
              const v = val[k] || { a: 0, p: 0 };
              const c = color(v.a, v.p);
              if (c === '#00FF00') tp += 1;
              else if (c === '#9b111e') fn += 1;
              else if (c === '#0000FF') fp += 1;
              return c;
            })
            .style('opacity', 0.7);

          update();
          drawChart({ tp, fn, fp });
        });

      /* ------------------ 위치 업데이트 ------------------ */
      function update() {
        const b  = map.getBounds();
        const tl = map.latLngToLayerPoint(b.getNorthWest());
        const br = map.latLngToLayerPoint(b.getSouthEast());

        svg
          .attr('width',  br.x - tl.x)
          .attr('height', br.y - tl.y)
          .style('left', `${tl.x}px`)
          .style('top',  `${tl.y}px`);

        g.attr('transform', `translate(${-tl.x}, ${-tl.y})`);
        dongLayer.selectAll('path').attr('d', geoPath);

        gridLayer.selectAll('rect')
          .attr('x', f => map.latLngToLayerPoint(rev(origin(f))).x)
          .attr('y', f => map.latLngToLayerPoint(rev(origin(f))).y)
          .attr('width',  f => {
            const [lng, lat] = origin(f);
            const p1 = map.latLngToLayerPoint([lat, lng]);
            const p2 = map.latLngToLayerPoint([lat + GRID, lng + GRID]);
            return p2.x - p1.x;
          })
          .attr('height', f => {
            const [lng, lat] = origin(f);
            const p1 = map.latLngToLayerPoint([lat, lng]);
            const p2 = map.latLngToLayerPoint([lat + GRID, lng + GRID]);
            return p1.y - p2.y;
          });
      }
      map.on('moveend zoomend', update);
      update();

      /* ------------------ 차트 ------------------ */
      function drawChart({ tp, fn, fp }) {
        const data = [
          { label: 'True Positive',  value: tp, color: '#00FF00' },
          { label: 'False Negative', value: fn, color: '#9b111e' },
          { label: 'False Positive', value: fp, color: '#0000FF' },
        ];
  
        const wrap = d3.select(chartRef.current);
        wrap.selectAll('*').remove();
  
        const margin = { top: 20, right: 10, bottom: 50, left: 55 };
        const W = CHART_W - margin.left - margin.right;   // 380 → 300+ 증분
        const H = CHART_H - margin.top  - margin.bottom;  // 280
  
        const svgC = wrap.append('svg')
          .attr('width',  W + margin.left + margin.right)
          .attr('height', H + margin.top  + margin.bottom);
  
        const g = svgC.append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);
  
        const x = d3.scaleBand()
          .domain(data.map(d => d.label))
          .range([0, W])
          .padding(0.35);
  
        const y = d3.scaleLinear()
          .domain([0, d3.max(data, d => d.value) || 1])
          .nice()
          .range([H, 0]);
  
        g.append('g')
          .attr('transform', `translate(0,${H})`)
          .call(d3.axisBottom(x).tickSizeOuter(0))
          .selectAll('text')
          .attr('transform', 'rotate(-30)')
          .style('text-anchor', 'end');
  
        g.append('g').call(d3.axisLeft(y).ticks(5));
  
        g.selectAll('rect')
          .data(data)
          .enter()
          .append('rect')
          .attr('x', d => x(d.label))
          .attr('y', d => y(d.value))
          .attr('width',  x.bandwidth())
          .attr('height', d => H - y(d.value))
          .attr('fill',  d => d.color);
      }
    });

    return () => map.remove();
  }, []);

  /* ------------------ JSX ------------------ */
  return (
    <div className="main-container">
      <h1>행정동&nbsp;→&nbsp;100 m 격자</h1>

      <div className="content-flex">
        {/* 지도 */}
        <div className="map-wrapper">
          <div id="map" style={{ width: 800, height: 600 }}></div>
        </div>

        {/* 차트 */}
        <div className="chart-wrapper">
          <h3>격자 예측 결과 개수</h3>
          <div ref={chartRef}></div>
        </div>
      </div>
    </div>
  );
}

// src/components/OurProject.js
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import './ourproject.css';

import introBanner from '../assets/ourproject_intro.png';

export default function OurProject() {
  /* ===== 상수 ===== */
  const GRID = 0.001;              // ≒ 100 m
  const Z_DONG = 13;
  const Z_GRID = 15;
  const CHART_W = 570;
  const CHART_H = 380;
  const MONTHS  = [6, 7, 8, 9, 10];
  const INITIAL_MONTH = 6;

  /* ===== ref / state ===== */
  const svgRef       = useRef(null);
  const chartRef     = useRef(null);
  const mapRef       = useRef(null);
  const dongLayerRef = useRef(null);
  const gridLayerRef = useRef(null);
  const dongGeoRef   = useRef(null);
  const gridGeoRef   = useRef(null);
  const dongGridRef  = useRef([]);      // 행정동 → 격자 index
  const valRef       = useRef({});      // {lng,lat:{a,p}}
  const loadCsvRef   = useRef(null);

  const [month, setMonth] = useState(INITIAL_MONTH);

  /* ===== 보조 ===== */
  const snap = ([x, y]) => [Math.floor(x / GRID) * GRID,
                            Math.floor(y / GRID) * GRID];

  const origin = f => {
    const g = f.geometry;
    if (g.type === 'Point')        return g.coordinates;
    if (g.type === 'Polygon')      return g.coordinates[0][0];
    if (g.type === 'MultiPolygon') return g.coordinates[0][0][0];
    return [0, 0];
  };
  const rev = ([x, y]) => [y, x];

  const tpColor = '#00FF00', fnColor = '#9b111e', fpColor = '#0000FF';
  const csvPath = m => `${process.env.PUBLIC_URL}/data/ssookssook_${String(m).padStart(2, '0')}.csv`;
  const colorF  = (a, p) => (a && p ? tpColor : a && !p ? fnColor : !a && p ? fpColor : '#ffffff');

  /* ───────── 초기화 ───────── */
  useEffect(() => {
    /* ① 지도 */
    const map = L.map('map', {
      center: [36.348, 127.376],
      zoom  : Z_DONG,
      layers: [L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
               { attribution: '© OpenStreetMap contributors' })],
    });
    mapRef.current = map;

    /* ② 범례 */
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const d = L.DomUtil.create('div', 'legend');
      d.innerHTML = `<h4>예측 결과</h4>
        <p><span class="tp"></span> 예측 성공</p>
        <p><span class="fn"></span> 예측 실패</p>
        <p><span class="fp"></span> 예측했으나<br>&nbsp;&nbsp;&nbsp;실제 미발생&nbsp;</p>`;
      return d;
    };
    legend.addTo(map);

    /* ③ SVG 오버레이 */
    if (!svgRef.current)
      svgRef.current = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    map.getPanes().overlayPane.appendChild(svgRef.current);
    const svg = d3.select(svgRef.current).style('position', 'absolute');

    const g         = svg.append('g');
    const dongLayer = g.append('g');
    const gridLayer = g.append('g').style('display', 'none');
    dongLayerRef.current = dongLayer;
    gridLayerRef.current = gridLayer;

    /* ④ GeoJSON 로드 */
    Promise.all([
      d3.json(`${process.env.PUBLIC_URL}/data/dong.geojson`),
      d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`),
    ]).then(([dongGeo, gridGeo]) => {
      dongGeoRef.current = dongGeo;
      gridGeoRef.current = gridGeo;

      /* 행정동 ↔ 격자 index 미리 계산 */
      dongGridRef.current = dongGeo.features.map(() => []);
      gridGeo.features.forEach((gf, gi) => {
        const cen = d3.geoCentroid(gf);
        dongGeo.features.forEach((df, di) => {
          if (d3.geoContains(df, cen)) dongGridRef.current[di].push(gi);
        });
      });

      drawDong();
      loadCsv(INITIAL_MONTH);
    });

    /* ── 행정동 경계 ── */
    function drawDong() {
      dongLayer.selectAll('path')
        .data(dongGeoRef.current.features)
        .enter()
        .append('path')
        .attr('data-di', (_d, i) => i)   // index 저장
        .attr('fill', '#b1b4e2')
        .style('pointer-events', 'all')
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .on('mouseover', function () { d3.select(this).attr('fill', '#d3d3d3'); })
        .on('mouseout',  function () { d3.select(this).attr('fill', d3.select(this).attr('data-prev')); })
        .on('click', function (_e, f) { showGrid(f, this); });

      updatePos();
    }

    /* ── 행정동 클릭 → 100 m 격자 ── */
    function showGrid(dongF, elem) {
      const [lng, lat] = d3.geoCentroid(dongF);
      map.setView([lat, lng], Z_GRID);

      gridLayer.style('display', 'block').selectAll('*').remove(); // reset

      const dongIdx = +elem.getAttribute('data-di');
      d3.select(elem).style('display', 'none'); // 선택된 행정동 숨김

      const inside = dongGridRef.current[dongIdx].map(
        idx => gridGeoRef.current.features[idx]
      );

      // ─ 격자 rect 추가 & 색상 계산 ─
      let tp = 0, fn = 0, fp = 0;
      gridLayer.selectAll('rect')
        .data(inside)
        .enter()
        .append('rect')
        .style('pointer-events', 'none')
        .attr('stroke', '#000')
        .attr('stroke-width', 0.1)
        .attr('fill', f => {
          const k = snap(origin(f)).join(',');
          const v = valRef.current[k] || { a: 0, p: 0 };
          const c = colorF(v.a, v.p);
          if (c === tpColor) tp++;
          else if (c === fnColor) fn++;
          else if (c === fpColor) fp++;
          return c;
        })
        .style('opacity', 0.7);

      updatePos();
      drawChart({ tp, fn, fp });
    }

    /* ── SVG 위치 보정 ── */
    function updatePos() {
      const b  = map.getBounds();
      const tl = map.latLngToLayerPoint(b.getNorthWest());
      const br = map.latLngToLayerPoint(b.getSouthEast());

      svg
        .attr('width',  br.x - tl.x)
        .attr('height', br.y - tl.y)
        .style('left',  `${tl.x}px`)
        .style('top',   `${tl.y}px`);
      g.attr('transform', `translate(${-tl.x},${-tl.y})`);

      if (dongGeoRef.current) {
        const geoPath = d3.geoPath().projection(
          d3.geoTransform({
            point(x, y) { const p = map.latLngToLayerPoint([y, x]); /* @ts-ignore */ this.stream.point(p.x, p.y); },
          }),
        );
        dongLayer.selectAll('path').attr('d', geoPath);
      }

      gridLayer.selectAll('rect')
        .attr('x', f => map.latLngToLayerPoint(rev(origin(f))).x)
        .attr('y', f => map.latLngToLayerPoint(rev(origin(f))).y)
        .attr('width',  f => {
          const [x, y] = origin(f);
          const p1 = map.latLngToLayerPoint([y, x]);
          const p2 = map.latLngToLayerPoint([y + GRID, x + GRID]);
          return p2.x - p1.x;
        })
        .attr('height', f => {
          const [x, y] = origin(f);
          const p1 = map.latLngToLayerPoint([y, x]);
          const p2 = map.latLngToLayerPoint([y + GRID, x + GRID]);
          return p1.y - p2.y;
        });
    }
    map.on('moveend zoomend', updatePos);

    /* ── 막대 차트 ── */
    function drawChart({ tp, fn, fp }) {
      const data = [
        { label: 'True Positive',  value: tp, color: tpColor },
        { label: 'False Negative', value: fn, color: fnColor },
        { label: 'False Positive', value: fp, color: fpColor },
      ];

      const wrap = d3.select(chartRef.current);
      wrap.select('svg').remove();

      const m = { top: 20, right: 10, bottom: 50, left: 55 };
      const W = CHART_W - m.left - m.right;
      const H = CHART_H - m.top  - m.bottom;

      const svgC = wrap.append('svg')
        .attr('width',  W + m.left + m.right)
        .attr('height', H + m.top  + m.bottom);

      const gC = svgC.append('g')
        .attr('transform', `translate(${m.left},${m.top})`);

      const x = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([0, W])
        .padding(0.35);
      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 1])
        .nice()
        .range([H, 0]);

      gC.append('g')
        .attr('transform', `translate(0,${H})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .selectAll('text')
        .attr('transform', 'rotate(-30)')
        .style('text-anchor', 'end');

      gC.append('g').call(d3.axisLeft(y).ticks(5));

      gC.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.label))
        .attr('y', d => y(d.value))
        .attr('width',  x.bandwidth())
        .attr('height', d => H - y(d.value))
        .attr('fill',   d => d.color);
    }

    /* ── 행정동 색 업데이트 ── */
    function updateDongColors() {
      const counts = dongGridRef.current.map(arr => {
        let c = 0;
        arr.forEach(idx => {
          const k = snap(origin(gridGeoRef.current.features[idx])).join(',');
          const v = valRef.current[k] || { a: 0, p: 0 };
          if (v.a && v.p) c++;
        });
        return c;
      });

      const min = d3.min(counts);
      const max = d3.max(counts);
      const scale = min === max
        ? () => '#0000FF'
        : d3.scaleLinear().domain([min, max]).range(['#0000FF', '#FF0000']);

      dongLayer.selectAll('path')
        .attr('fill', function (_d, i) {
          const col = scale(counts[i]);
          d3.select(this).attr('data-prev', col);
          return col;
        });
    }

    /* ── CSV 로더 ── */
    function loadCsv(m) {
      d3.csv(csvPath(m)).then(csv => {
        const tmp = {};
        csv.forEach(r => {
          const k = snap([+r.경도, +r.위도]).join(',');
          tmp[k] = { a: +r.실제값 || 0, p: +r.예측값 || 0 };
        });
        valRef.current = tmp;

        // 격자 레이어가 열려 있으면 색상 즉시 갱신
        if (gridLayerRef.current.selectAll('rect').size() > 0) {
          let tp = 0, fn = 0, fp = 0;
          gridLayerRef.current.selectAll('rect')
            .attr('fill', f => {
              const k = snap(origin(f)).join(',');
              const v = valRef.current[k] || { a: 0, p: 0 };
              const c = colorF(v.a, v.p);
              if (c === tpColor) tp++;
              else if (c === fnColor) fn++;
              else if (c === fpColor) fp++;
              return c;
            });
          drawChart({ tp, fn, fp });
        }
        updateDongColors();
      });
    }
    loadCsvRef.current = loadCsv;

    return () => map.remove();
  }, []);

  /* 월 변경 → CSV 교체 */
  useEffect(() => {
    if (loadCsvRef.current) loadCsvRef.current(month);
  }, [month]);

  /* ===== 렌더 ===== */
  return (
    <div className="main-container">
      <img src={introBanner} alt="Intro Banner" className="intro-banner" />
      <h1>행정동&nbsp;→&nbsp;100 m 격자</h1>

      {/* 월 선택 */}
      <div className="month-selector">
        {MONTHS.map(m => (
          <button
            key={m}
            className={m === month ? 'active' : ''}
            onClick={() => setMonth(m)}
          >
            {m}월
          </button>
        ))}
      </div>

      <div className="content-flex">
        <div className="map-wrapper"><div id="map" /></div>
        <div className="chart-wrapper">
          <h3>격자 예측 결과 개수</h3>
          <div ref={chartRef} />
        </div>
      </div>
    </div>
  );
}

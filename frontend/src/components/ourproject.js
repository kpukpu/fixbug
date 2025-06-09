// ───────────── src/components/OurProject.js ─────────────
import React, { useEffect, useRef, useState } from 'react';
import L   from 'leaflet';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import './ourproject.css';

export default function OurProject() {
  /* ===== 상수 ===== */
  const GRID_OPACITY     = 0.95;          // 모든 100 m 격자 기본 투명도
  const DONG_OPACITY     = 0.45;          // 행정동 투명도
  const HIGHLIGHT_COLOR  = '#FFCA1A';     // 실제 민원 격자 색
  const GRID             = 0.001;         // ≒ 100 m
  const Z_DONG           = 13;
  const Z_GRID           = 15;
  const CHART_W          = 570;
  const CHART_H          = 380;
  const MONTHS           = [6, 7, 8, 9, 10];
  const INITIAL_MONTH    = 6;

  /* ===== ref / state ===== */
  const svgRef         = useRef(null);
  const lastHiddenRef = useRef(null);   // ← 직전에 사라진 행정동 보관
  const chartRef       = useRef(null);
  const mapRef         = useRef(null);
  const gridLayerRef   = useRef(null);
  const dongLayerRef   = useRef(null);
  const dongGeoRef     = useRef(null);
  const gridGeoRef     = useRef(null);
  const dongGridRef    = useRef([]);      // 행정동 → 격자 index
  const valRef         = useRef({});      // {lng,lat:{a,p}}
  const loadCsvRef     = useRef(null);
  const downPtRef = useRef(null);   // 마우스 눌렀을 때 화면 좌표


  const [month,      setMonth]      = useState(INITIAL_MONTH);
  const [showActual, setShowActual] = useState(true);       // 토글 상태

  /* ===== 보조 ===== */
  const snap = ([x, y]) => [Math.floor(x / GRID) * GRID,
                            Math.floor(y / GRID) * GRID];

  const origin = f => {
    if (!f || !f.geometry) return [0, 0];
    const g = f.geometry;
    if (g.type === 'Point')        return g.coordinates;
    if (g.type === 'Polygon')      return g.coordinates[0][0];
    if (g.type === 'MultiPolygon') return g.coordinates[0][0][0];
    return [0, 0];
  };
  const rev = ([x, y]) => [y, x];

  const tpColor = '#00FF00',
        fnColor = '#9b111e',
        fpColor = '#0000FF';

  const csvPath = m =>
    `${process.env.PUBLIC_URL}/data/ssookssook_${String(m).padStart(2, '0')}.csv`;

  const baseColorF = (a, p) =>
    a && p ? tpColor : a && !p ? fnColor : !a && p ? fpColor : '#ffffff';

  /* ───────── 격자 색상만 다시 칠하기 ───────── */
  const recolorGrid = (actualOn = showActual) => {
    if (!gridLayerRef.current || !gridGeoRef.current) return;

    gridLayerRef.current
      .selectAll('rect')
      .attr('fill', f => {
        const k = snap(origin(f)).join(',');
        const v = valRef.current[k] || { a: 0, p: 0 };
        if (actualOn && v.a) return HIGHLIGHT_COLOR;   // 노란색
        return baseColorF(v.a, v.p);                   // 기본색
      })
      .attr('fill-opacity', f => {
        const k = snap(origin(f)).join(',');
        const v = valRef.current[k] || { a: 0 };
        return actualOn && v.a ? 1 : GRID_OPACITY;     // 노란색은 불투명
      });
  };

  /* ───────── 초기화 : 단 한 번 실행 ───────── */
  useEffect(() => {
    /* ① Leaflet 지도 */
    const map = L.map('map', {
      center: [36.348, 127.376],
      zoom  : Z_DONG,
      layers: [
        L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenStreetMap contributors' },
        ),
      ],
    });
    mapRef.current = map;

    /* ② 범례 */
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const d = L.DomUtil.create('div', 'legend');
      d.innerHTML =
       `<h4 style="margin:0 0 4px;">민원 발생률 높음</h4>
        <div class="spectrum-bar"></div>
        <div class="legend-txt">
      <span>민원 발생률 낮음</span>
    </div>`;
      return d;
    };
    legend.addTo(map);

    /* ③ SVG 오버레이 */
    if (!svgRef.current)
      svgRef.current = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    map.getPanes().overlayPane.appendChild(svgRef.current);
    const svg = d3.select(svgRef.current).style('position', 'absolute');

    /* gridLayer → dongLayer */
    const g         = svg.append('g');
    const gridLayer = g.append('g').style('pointer-events', 'none');
    const dongLayer = g.append('g');
    gridLayerRef.current = gridLayer;
    dongLayerRef.current = dongLayer;

    /* ④ GeoJSON 로드 */
    Promise.all([
      d3.json(`${process.env.PUBLIC_URL}/data/dong.geojson`),
      d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`),
    ]).then(([dongGeo, gridGeo]) => {
      dongGeoRef.current = dongGeo;
      gridGeoRef.current = gridGeo;

      /* 행정동 ↔ 격자 index */
      dongGridRef.current = dongGeo.features.map(() => []);
      gridGeo.features.forEach((gf, gi) => {
        const cen = d3.geoCentroid(gf);
        dongGeo.features.forEach((df, di) => {
          if (d3.geoContains(df, cen)) dongGridRef.current[di].push(gi);
        });
      });

      drawGrid();
      drawDong();
      loadCsv(INITIAL_MONTH);
    });

    /* 전체 격자 그리기 */
    function drawGrid() {
      gridLayer
        .selectAll('rect')
        .data(gridGeoRef.current.features)
        .enter()
        .append('rect')
        .attr('stroke', '#000')
        .attr('stroke-width', 0.1)
        .attr('fill', baseColorF(0, 0))
        .attr('fill-opacity', GRID_OPACITY);

      updatePos();
    }

    /* 행정동 경계 그리기 */
    function drawDong() {
      dongLayer
        .selectAll('path')
        .data(dongGeoRef.current.features)
        .enter()
        .append('path')
        .attr('data-di', (_d, i) => i)
        .attr('fill', '#b1b4e2')
        .attr('fill-opacity', DONG_OPACITY)
        .style('pointer-events', 'all')
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .on('mouseover', function () {
          d3.select(this).attr('fill', '#d3d3d3');
        })
        .on('mouseout', function () {
          d3.select(this).attr('fill', d3.select(this).attr('data-prev'));
        })
        /*.on('click', function (_e, f) {
          showGridStats(f, this);
        });*/
        .on('mousedown', function (e) {
          downPtRef.current = [e.clientX, e.clientY];
          })
          .on('mouseup', function (e, f) {
            if (!downPtRef.current) return;          
            const [x0, y0] = downPtRef.current;
            const dx = e.clientX - x0;  
            const dy = e.clientY - y0;
            const moved2 = dx*dx + dy*dy;            
             downPtRef.current = null;
             if (moved2 < 25)  
               showGridStats(f, this);
              });

      updatePos();
    }

    /* 행정동 클릭 → 통계 */
    function showGridStats(dongF, elem) {
      if (lastHiddenRef.current)
        d3.select(lastHiddenRef.current).style('display', null);
      d3.select(elem).style('display', 'none');
      lastHiddenRef.current = elem;
      const dongIdx = +elem.getAttribute('data-di');
      const inside  = dongGridRef.current[dongIdx];

      let tp = 0, fn = 0, fp = 0;
      inside.forEach(idx => {
        const f = gridGeoRef.current.features[idx];
        const k = snap(origin(f)).join(',');
        const v = valRef.current[k] || { a: 0, p: 0 };
        const c = baseColorF(v.a, v.p);
        if (c === tpColor) tp++;
        else if (c === fnColor) fn++;
        else if (c === fpColor) fp++;
      });

      const [lng, lat] = d3.geoCentroid(dongF);
      map.setView([lat, lng], Z_GRID);

      drawChart({ tp, fn, fp });
    }

    /* 위치 보정 */
    function updatePos() {
      const b  = map.getBounds();
      const tl = map.latLngToLayerPoint(b.getNorthWest());
      const br = map.latLngToLayerPoint(b.getSouthEast());

      d3.select(svgRef.current)
        .attr('width',  br.x - tl.x)
        .attr('height', br.y - tl.y)
        .style('left',  `${tl.x}px`)
        .style('top',   `${tl.y}px`);
      g.attr('transform', `translate(${-tl.x},${-tl.y})`);

      /* path */
      if (dongGeoRef.current) {
        const geoPath = d3.geoPath().projection(
          d3.geoTransform({
            point(x, y) {
              const p = map.latLngToLayerPoint([y, x]);
              /* @ts-ignore */
              this.stream.point(p.x, p.y);
            },
          }),
        );
        dongLayer.selectAll('path').attr('d', geoPath);
      }

      /* rect */
      gridLayer
        .selectAll('rect')
        .attr('x', f => map.latLngToLayerPoint(rev(origin(f))).x)
        .attr('y', f => map.latLngToLayerPoint(rev(origin(f))).y)
        .attr('width', f => {
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

    /* 막대 차트 */
    function drawChart({ tp, fn, fp }) {
      const total = tp + fn + fp;
      const empty = Math.max(
        0,
        total ? gridLayer.selectAll('rect').size() - total : 0,
      );
      const ratio = empty ? tp / empty : 0;

      const data = [
        { label: 'TP', value: tp, color: tpColor },
        { label: 'FN', value: fn, color: fnColor },
        { label: 'FP', value: fp, color: fpColor },
        { label: 'TP/Empty', value: ratio, color: '#ffbf00' },
      ];

      const wrap = d3.select(chartRef.current);
      wrap.select('svg').remove();

      const m = { top: 20, right: 10, bottom: 60, left: 55 };
      const W = CHART_W - m.left - m.right;
      const H = CHART_H - m.top - m.bottom;

      const svgC = wrap
        .append('svg')
        .attr('width', W + m.left + m.right)
        .attr('height', H + m.top + m.bottom);

      const g = svgC
        .append('g')
        .attr('transform', `translate(${m.left},${m.top})`);

      const x = d3
        .scaleBand()
        .domain(data.map(d => d.label))
        .range([0, W])
        .padding(0.35);

      const y = d3
        .scaleLinear()
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
        .attr('width', x.bandwidth())
        .attr('height', d => H - y(d.value))
        .attr('fill', d => d.color);

      g.selectAll('text.val')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'val')
        .attr('x', d => x(d.label) + x.bandwidth() / 2)
        .attr('y', d => y(d.value) - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(d =>
          d.label === 'TP/Empty'
            ? (d.value * 100).toFixed(1) + '%'
            : d.value,
        );
    }

    /* 행정동 색상 */
    function updateDongColors() {
      const ratios = dongGridRef.current.map(arr => {
        if (arr.length === 0) return 0;
        let predicted = 0;
        arr.forEach(idx => {
          const k = snap(origin(gridGeoRef.current.features[idx])).join(',');
          const v = valRef.current[k] || { p: 0 };
          if (v.p) predicted += 1;
        });
        return predicted / arr.length;
      });

      const colorScale = d3
        .scaleLinear()
        .domain([0, 0.1])
        .range(['#0000FF', '#FF0000']);

      dongLayer
        .selectAll('path')
        .attr('fill', function (_d, i) {
          const col = colorScale(ratios[i]);
          d3.select(this).attr('data-prev', col);
          return col;
        })
        .attr('fill-opacity', DONG_OPACITY);
    }

    /* CSV 로드 */
    function loadCsv(m) {
      d3.csv(csvPath(m)).then(csv => {
        const tmp = {};
        csv.forEach(r => {
          const k = snap([+r.경도, +r.위도]).join(',');
          tmp[k] = { a: +r.실제값 || 0, p: +r.예측값 || 0 };
        });
        valRef.current = tmp;

        recolorGrid();     // 첫 색칠
        updateDongColors();
      });
    }
    loadCsvRef.current = loadCsv;

    return () => map.remove();
  }, []);   // ← 의존성 배열 비워서 한 번만 실행

  /* ───────── showActual 토글 → 색상 갱신 ───────── */
  useEffect(() => {
    recolorGrid(showActual);
  }, [showActual]);

  /* ───────── 월 변경 → CSV 재로드 ───────── */
  useEffect(() => {
    if (loadCsvRef.current) loadCsvRef.current(month);
  }, [month]);

  /* ===== 렌더 ===== */
  return (
    <div className="main-container">
      <h1>행정동&nbsp;→&nbsp;100 m&nbsp;격자</h1>

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
        <button style={{ marginLeft: '1rem' }}
                onClick={() => setShowActual(v => !v)}>
          실제 민원 {showActual ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="content-flex">
        <div className="map-wrapper">
          <div id="map" />
        </div>
        <div className="chart-wrapper">
          <h3>격자 예측 결과 개수</h3>
          <div ref={chartRef} />
        </div>
      </div>
    </div>
  );
}

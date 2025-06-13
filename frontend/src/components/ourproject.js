// ───────────── src/components/OurProject.js ─────────────
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L   from 'leaflet';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import './ourproject.css';

export default function OurProject() {
  /* ===== 상수 ===== */
  const GRID_OPACITY     = 0.95;
  const DONG_OPACITY     = 0.45;
  const HIGHLIGHT_COLOR  = '#FFCA1A';

  const GRID             = 0.001;        // ≒ 100 m
  const Z_DONG           = 13;
  const Z_GRID           = 15;

  const MONTHS           = [6, 7, 8, 9, 10];
  const INITIAL_MONTH    = 6;

  const API_URL          = 'http://13.124.192.99:8000/api/dong_data/';

  /* ===== refs / state ===== */
  const svgRef        = useRef(null);
  const lastHiddenRef = useRef(null);
  const chartRef      = useRef(null);
  const mapRef        = useRef(null);
  const gridLayerRef  = useRef(null);
  const dongLayerRef  = useRef(null);
  const dongGeoRef    = useRef(null);
  const gridGeoRef    = useRef(null);
  const dongGridRef   = useRef([]);     // 행정동 → 격자 index
  const valRef        = useRef({});     // {lng,lat : {a,p}}
  const loadCsvRef    = useRef(null);
  const downPtRef     = useRef(null);

  const [month,      setMonth]      = useState(INITIAL_MONTH);
  const [showActual, setShowActual] = useState(true);

  /* ===== 보조 함수 ===== */
  const snap = ([x, y]) => [Math.floor(x / GRID) * GRID, Math.floor(y / GRID) * GRID];

  const origin = f => {
    if (!f?.geometry) return [0, 0];
    const g = f.geometry;
    if (g.type === 'Point')        return g.coordinates;
    if (g.type === 'Polygon')      return g.coordinates[0][0];
    if (g.type === 'MultiPolygon') return g.coordinates[0][0][0];
    return [0, 0];
  };
  const rev = ([x, y]) => [y, x];

  /* 색상 */
  const tpColor = '#9b111e', fnColor = '#ffffff', fpColor = '#9b111e';
  const baseColorF = (a, p) =>
    a && p ? tpColor : a && !p ? fnColor : !a && p ? fpColor : '#ffffff';

  /* CSV 경로 */
  const csvPath = m =>
    `${process.env.PUBLIC_URL}/data/ssookssook_${String(m).padStart(2, '0')}.csv`;

  /* ───────── 격자 색만 다시 칠하기 ───────── */
  const recolorGrid = useCallback((actualOn = showActual) => {
    if (!gridLayerRef.current || !gridGeoRef.current) return;
    gridLayerRef.current
      .selectAll('rect')
      .attr('fill', f => {
        const k = snap(origin(f)).join(',');
        const v = valRef.current[k] || { a: 0, p: 0 };
        if (actualOn && v.a) return HIGHLIGHT_COLOR;
        return baseColorF(v.a, v.p);
      })
      .attr('fill-opacity', f => {
        const k = snap(origin(f)).join(',');
        const v = valRef.current[k] || { a: 0 };
        return actualOn && v.a ? 1 : GRID_OPACITY;
      });
  }, [showActual]);

  /* ───────────────────────── 초기화 ───────────────────────── */
  useEffect(() => {
    /* ① Leaflet 맵 */
    const map = L.map('map', {
      center: [36.348, 127.376],
      zoom  : Z_DONG,
      layers: [L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '© OpenStreetMap contributors' }
      )]
    });
    mapRef.current = map;

    /* ② 범례 */
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const d = L.DomUtil.create('div', 'legend');
      d.innerHTML = `<h4 style="margin:0 0 4px;">민원 발생 가능성 높음</h4>
        <div class="spectrum-bar"></div>
        <div class="legend-txt"><span>민원 발생 가능성 낮음</span></div>`;
      return d;
    };
    legend.addTo(map);

    /* ③ SVG overlay */
    if (!svgRef.current)
      svgRef.current = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    map.getPanes().overlayPane.appendChild(svgRef.current);
    const svg        = d3.select(svgRef.current).style('position', 'absolute');
    const g          = svg.append('g');
    const gridLayer  = g.append('g').style('pointer-events', 'auto');  // 클릭 허용
    const dongLayer  = g.append('g');
    gridLayerRef.current = gridLayer;
    dongLayerRef.current = dongLayer;

    /* ④ GeoJSON + CSV */
    Promise.all([
      d3.json(`${process.env.PUBLIC_URL}/data/dong.geojson`),
      d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`)
    ]).then(([dongGeo, gridGeo]) => {
      dongGeoRef.current = dongGeo;
      gridGeoRef.current = gridGeo;

      /* 행정동 ↔ 격자 매핑 */
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

    /* ───────── drawGrid ───────── */
    function drawGrid() {
      gridLayer.selectAll('rect')
        .data(gridGeoRef.current.features)
        .enter().append('rect')
        .attr('stroke', '#000')
        .attr('stroke-width', 0.1)
        .attr('fill', baseColorF(0, 0))
        .attr('fill-opacity', GRID_OPACITY)
        .style('pointer-events', 'all')
        .on('click', (e, f) => {
          console.log('clicked', origin(f));   // 디버깅용
          gridClickHandler(e, f);
        });

      updatePos();
    }

    /* ──────── 그리드 클릭 → 좌표 POST ──────── */
    async function gridClickHandler(_, f) {
      const [lng, lat] = origin(f);

      try {
        const res = await fetch(API_URL, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ longitude: lng, latitude: lat })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const metaResp = await res.json();
        const meta     = (metaResp.data || [])[0] || {};  // 첫 레코드

        const key   = snap([lng, lat]).join(',');
        const val   = valRef.current[key] || { a: 0, p: 0 };
        const level = !val.a && val.p ? 'purple' : 'blue';

        drawHazardBox(level, 0, meta);
      } catch (err) {
        console.error(err);
        drawHazardBox('blue', 0, { error: '데이터 요청 실패' });
      }
    }

    /* ───────── drawDong ───────── */
    function drawDong() {
      dongLayer.selectAll('path')
        .data(dongGeoRef.current.features)
        .enter().append('path')
        .attr('data-di', (_, i) => i)
        .attr('fill', '#b1b4e2')
        .attr('fill-opacity', DONG_OPACITY)
        .style('pointer-events', 'all')
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .on('mouseover', function () { d3.select(this).attr('fill', '#d3d3d3'); })
        .on('mouseout',  function () { d3.select(this).attr('fill', d3.select(this).attr('data-prev')); })
        .on('mousedown', e => { downPtRef.current = [e.clientX, e.clientY]; })
        .on('mouseup', function (e, f) {
          if (!downPtRef.current) return;
          const [x0, y0] = downPtRef.current;
          const dx = e.clientX - x0, dy = e.clientY - y0;
          downPtRef.current = null;
          if (dx * dx + dy * dy > 25) return;   // 드래그 무시
          showDongInfo(f, this);
        });

      updatePos();
    }

    /* ───────── 행정동 클릭 InfoBox ───────── */
    function showDongInfo(dongF, elem) {
      if (lastHiddenRef.current)
        d3.select(lastHiddenRef.current).style('display', null);
      d3.select(elem).style('display', 'none');
      lastHiddenRef.current = elem;

      const dongIdx = +elem.getAttribute('data-di');
      const inside  = dongGridRef.current[dongIdx];

      let blueCnt = 0;
      inside.forEach(idx => {
        const f = gridGeoRef.current.features[idx];
        const k = snap(origin(f)).join(',');
        const v = valRef.current[k] || { a: 0, p: 0 };
        if (!v.a && v.p) blueCnt += 1;
      });

      const ratio = inside.length ? blueCnt / inside.length : 0;
      let level   = 'blue';
      if (ratio >= 0.07)      level = 'red';
      else if (ratio >= 0.03) level = 'purple';

      const [lng, lat] = d3.geoCentroid(dongF);
      map.setView([lat, lng], Z_GRID);
drawHazardBox(level, blueCnt, {
  dong_name: dongF.properties?.EMD_KOR_NM || dongF.properties?.name || '',
  h_area   : '1',           // 정보가 없으면 빈 문자열
  grid_100 : '',           //  〃
  b_area   : ''            //  〃
});
    }

    /* ───────── InfoBox 렌더 ───────── */
    function drawHazardBox(level, cnt, meta = {}) {
      const wrap = d3.select(chartRef.current);   // ✅ 변수명 통일
      wrap.selectAll('*').remove();

      const dict = {
        red:    { title: '위험',  icon: '🚨', color: '#ff4d4d',
                  desc:  '해충 민원 발생 확률이 매우 높습니다 <br/> 해충 방역을 권장합니다.' },
        purple: { title: '경고',  icon: '⚠️', color: '#ffbf00',
                  desc:  '해충 민원 발생 확률이 높습니다! <br/> 해충 방역을 권고합니다.' },
        blue:   { title: '안전',  icon: '👍', color: '#4da6ff',
                  desc:  '해충 민원 발생률이 저조합니다!' }
      };
      const d = dict[level];

      wrap.append('div')
        .style('background', 'rgba(0,0,0,0.85)')
        .style('padding', '24px 32px')
        .style('border-radius', '10px')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('align-items', 'center')
        .style('gap', '12px')
        .html(`
          ${meta.dong_name ? `
            <div style="font-size:26px;font-weight:600">${meta.dong_name}</div>` : ''}
          <div style="font-size:34px;font-weight:700;color:${d.color}">${d.title}</div>
          <div style="font-size:54px">${d.icon}</div>

          <div style="font-size:18px">${d.desc}</div>
          ${meta.grid_100 ? `
          <div style="font-size:16px;line-height:1.6">
          <b>행정동&nbsp;:&nbsp;</b>${meta.dong_name || '-'}<br/>
          <b>기초구역&nbsp;:&nbsp;</b>${meta.h_area    || '-'}<br/>
          <b>100 m 격자&nbsp;:&nbsp;</b>${meta.grid_100}<br/>
          <b>법정동명&nbsp;:&nbsp;</b>${meta.b_area   || '-'}
          </div>` : ''}
          ${meta.error ? `
            <div style="font-size:16px;color:#ff4d4d">${meta.error}</div>` : ''}
        `);
    }

    /* ───────── 위치 보정 ───────── */
    function updatePos() {
      const b  = map.getBounds(),
            tl = map.latLngToLayerPoint(b.getNorthWest()),
            br = map.latLngToLayerPoint(b.getSouthEast());

      d3.select(svgRef.current)
        .attr('width',  br.x - tl.x)
        .attr('height', br.y - tl.y)
        .style('left', `${tl.x}px`)
        .style('top',  `${tl.y}px`);
      g.attr('transform', `translate(${-tl.x},${-tl.y})`);

      /* 행정동 path */
      if (dongGeoRef.current) {
        const geoPath = d3.geoPath().projection(
          d3.geoTransform({
            point(x, y) {
              const p = map.latLngToLayerPoint([y, x]);
              /* @ts-ignore */
              this.stream.point(p.x, p.y);
            }
          })
        );
        dongLayer.selectAll('path').attr('d', geoPath);
      }

      /* 격자 rect */
      gridLayer.selectAll('rect')
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

    /* ───────── 행정동 색 초기화 ───────── */
    function updateDongColors() {
      const ratios = dongGridRef.current.map(arr => {
        if (!arr.length) return 0;
        let predicted = 0;
        arr.forEach(idx => {
          const k = snap(origin(gridGeoRef.current.features[idx])).join(',');
          const v = valRef.current[k] || { p: 0 };
          if (v.p) predicted += 1;
        });
        return predicted / arr.length;
      });

      const colorScale = d3.scaleLinear()
        .domain([0, 0.1])
        .range(['#0000FF', '#FF0000']);

      dongLayer.selectAll('path')
        .attr('fill', function (_, i) {
          const c = colorScale(ratios[i]);
          d3.select(this).attr('data-prev', c);
          return c;
        })
        .attr('fill-opacity', DONG_OPACITY);
    }

    /* ───────── CSV 로드 ───────── */
    function loadCsv(m) {
      d3.csv(csvPath(m)).then(csv => {
        const tmp = {};
        csv.forEach(r => {
          const k = snap([+r.경도, +r.위도]).join(',');
          tmp[k] = { a: +r.실제값 || 0, p: +r.예측값 || 0 };
        });
        valRef.current = tmp;
        recolorGrid();        // 격자 색
        updateDongColors();   // 행정동 색
      });
    }
    loadCsvRef.current = loadCsv;

    /* 첫 화면 기본 InfoBox */
    drawHazardBox('blue', 0);

    return () => map.remove();
  }, []);   // 최초 1회

  /* 격자 ON/OFF */
  useEffect(() => { recolorGrid(showActual); }, [showActual, recolorGrid]);

  /* 월 변경 */
  useEffect(() => { if (loadCsvRef.current) loadCsvRef.current(month); }, [month]);

  /* ─────────── JSX ─────────── */
  return (
    <div className="main-container">
      <h1>20년도&nbsp;월별&nbsp;해충&nbsp;방역지&nbsp;추천 (행정동/격자)</h1>

      <div className="month-selector">
        {MONTHS.map(m => (
          <button key={m}
                  className={m === month ? 'active' : ''}
                  onClick={() => setMonth(m)}>
            {m}월
          </button>
        ))}
        <button style={{ marginLeft: '1rem' }}
                onClick={() => setShowActual(v => !v)}>
          기존 민원 발생지 {showActual ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="content-flex">
        <div className="map-wrapper">
          <div id="map" />
        </div>

        {/* InfoBox */}
        <div className="chart-wrapper info-box">
          <div ref={chartRef}
               style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
        </div>
      </div>
    </div>
  );
}

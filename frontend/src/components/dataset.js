// Dataset.js
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import './dataset.css';

const Dataset = () => {
  const svgRef            = useRef(null);
  const selectedChartRef  = useRef(null);
  const featureChartRef   = useRef(null);
  const [gridData, setGridData] = useState(null);

  /* ───────── Feature Importance 원본 데이터 ───────── */
  const featureImportanceData = [
    { feature: '위도',                   importance: 0.2032174616968298 },
    { feature: '경도',                   importance: 0.16670527622852893 },
    { feature: '평균_토지_공시지가',       importance: 0.048534008 },
    { feature: '평균_토지_면적',           importance: 0.035985845188414405 },
    { feature: '합계_토지_면적',           importance: 0.035915545 },
    { feature: '평균_토지대장_공시지가',    importance: 0.03382206 },
    { feature: '합계_토지필지수',          importance: 0.018259208 },
    { feature: '합계_토지_지목수_계',       importance: 0.017903365 },
    { feature: '인구_연령_20대',           importance: 0.017359783796625047 },
    { feature: '합계_토지_지목수_전',       importance: 0.015415886802757003 },
    { feature: '인구_연령_40대',           importance: 0.014241199 },
    { feature: '합계_토지_지목수_구거',     importance: 0.014235885155369579 },
    { feature: '최대_건축물_사용승인일',     importance: 0.013660690780757772 },
    { feature: '인구_연령_30대',           importance: 0.012676483816991647 },
    { feature: '평균_건물_일반_지상층수',    importance: 0.012559764048248817 },
  ];

  /* ───────────────────────── Leaflet + D3 초기화 ───────────────────────── */
  useEffect(() => {
    const fetchData = async () => {
      const gridSize = 0.001; // 100 m 단위

      const map = L.map('map', {
        center: [36.35, 127.38],
        zoom  : 12,
        layers: [
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
          }),
        ],
      });

      // D3용 SVG 캔버스를 Leaflet overlayPane에 삽입
      map.getPanes().overlayPane.appendChild(svgRef.current);
      const svg = d3.select(svgRef.current)
                    .style('position', 'absolute')
                    .style('z-index', 999)
                    .style('pointer-events', 'none');
      svg.selectAll('*').remove();

      try {
        // 데이터 불러오기
        const [csvData, daejeonData, seoGuData] = await Promise.all([
          d3.csv(`${process.env.PUBLIC_URL}/data/ssookssook.csv`),
          d3.json(`${process.env.PUBLIC_URL}/data/daejeon.geojson`),
          d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`)
        ]);

        if (!daejeonData?.features || !seoGuData?.features) {
          throw new Error('GeoJSON 데이터가 비어 있습니다.');
        }

        // 예측/실제 매핑
        const valueMap = {};
        csvData.forEach(row => {
          const lat   = +row['위도'];
          const lng   = +row['경도'];
          const actual  = +row['실제값']  || 0;
          const predict = +row['예측값']  || 0;
          const key = alignToGrid([lng, lat], gridSize).join(',');
          valueMap[key] = { actual, predict };
        });

        const g = svg.append('g');

        // 대전 전체 경계선
        const polygonGroup = g.append('path')
          .attr('fill', 'none')
          .attr('stroke', '#999')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none');

        // 100 m 격자 셀
        const cells = g.selectAll('.grid-cell')
          .data(seoGuData.features.filter(f => f.geometry?.coordinates))
          .enter().append('rect')
          .attr('class', 'grid-cell')
          .attr('stroke', '#000')
          .attr('stroke-width', 0.1)
          .style('pointer-events', 'all')
          .style('opacity', 0.7)
          .attr('fill', d => {
            const [lng, lat] = d.geometry.coordinates;
            const key = alignToGrid([lng, lat], gridSize).join(',');
            const { actual = 0, predict = 0 } = valueMap[key] || {};
            return getColor(actual, predict);
          })
          .on('mouseover', function () { d3.select(this).attr('fill', '#ffcc00').style('opacity', 1); })
          .on('mouseout', function (e, d) {
            const [lng, lat] = d.geometry.coordinates;
            const key = alignToGrid([lng, lat], gridSize).join(',');
            const { actual = 0, predict = 0 } = valueMap[key] || {};
            d3.select(this).attr('fill', getColor(actual, predict)).style('opacity', 0.7);
          })
          .on('click', (e, d) => {
            const [lng, lat] = d.geometry.coordinates;
            map.setView([lat, lng], 15);
            sendCoordinatesToBackend([lng, lat]);
          });

        // Leaflet view → D3 업데이트 함수
        const update = () => {
          const bounds = map.getBounds();
          const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
          const bottomRight = map.latLngToLayerPoint(bounds.getSouthEast());

          svg.attr('width',  bottomRight.x - topLeft.x)
             .attr('height', bottomRight.y - topLeft.y)
             .style('left',  `${topLeft.x}px`)
             .style('top',   `${topLeft.y}px`);
          g.attr('transform', `translate(${-topLeft.x}, ${-topLeft.y})`);

          // 셀 위치 & 크기 재계산
          cells
            .attr('x', d => map.latLngToLayerPoint([d.geometry.coordinates[1], d.geometry.coordinates[0]]).x)
            .attr('y', d => map.latLngToLayerPoint([d.geometry.coordinates[1], d.geometry.coordinates[0]]).y)
            .attr('width',  d => {
              const [lng, lat] = d.geometry.coordinates;
              const p1 = map.latLngToLayerPoint([lat, lng]);
              const p2 = map.latLngToLayerPoint([lat + gridSize, lng + gridSize]);
              return p2.x - p1.x;
            })
            .attr('height', d => {
              const [lng, lat] = d.geometry.coordinates;
              const p1 = map.latLngToLayerPoint([lat, lng]);
              const p2 = map.latLngToLayerPoint([lat + gridSize, lng + gridSize]);
              return p1.y - p2.y;
            });

          /* 대전 외곽선 경로 업데이트 */
          const coords = daejeonData.features[0].geometry.type === 'MultiPolygon'
            ? daejeonData.features[0].geometry.coordinates[0][0]
            : daejeonData.features[0].geometry.coordinates[0];

          const pathData = coords.map(([lng, lat]) => {
            const p = map.latLngToLayerPoint([lat, lng]);
            return [p.x, p.y];
          });
          polygonGroup.attr('d', d3.line()(pathData));
        };

        map.on('moveend zoomend', update);
        update();

        /* helper 함수들 */
        function alignToGrid([lng, lat], size) {
          return [Math.floor(lng / size) * size, Math.floor(lat / size) * size];
        }
        function getColor(a, p) {
          if (a === 1 && p === 1) return '#00ff00';
          if (a === 1 && p === 0) return '#9b111e';
          if (a === 0 && p === 1) return '#0000ff';
          return '#ffffff';
        }
        async function sendCoordinatesToBackend([lng, lat]) {
          try {
            const res = await fetch('http://13.124.192.99:8000/api/get_xy/', {
              method : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body   : JSON.stringify({ longitude: lng, latitude: lat }),
            });
            if (res.ok) {
              const { data } = await res.json();
              setGridData(data[0]);
            } else console.error('백엔드 요청 실패:', res.status);
          } catch (err) { console.error('통신 에러:', err); }
        }
      } catch (err) { console.error('데이터 로드 오류:', err); }
    };
    fetchData();
  }, []);

  /* 선택 격자 → 연령별 막대그래프 */
  useEffect(() => {
    if (gridData) renderSelectedChart(gridData);
    else         clearSelectedChart();
  }, [gridData]);

  /* Feature Importance 도넛그래프 */
  useEffect(() => { renderDonut(); }, []);

  /* ───────── 내부 차트 함수들 ───────── */
  function renderSelectedChart(d) {
    const chartEl = d3.select(selectedChartRef.current);
    chartEl.selectAll('*').remove();

    const ageData = [
      { age: '유아',        value: d.realkid  || 0 },
      { age: '초등학생',    value: d.element  || 0 },
      { age: '중학생',      value: d.middle   || 0 },
      { age: '고등학생',    value: d.high     || 0 },
      { age: '20대',        value: d.twenty   || 0 },
      { age: '30대',        value: d.thirty   || 0 },
      { age: '40대',        value: d.fourty   || 0 },
      { age: '50대',        value: d.fifty    || 0 },
      { age: '60대',        value: d.sixty    || 0 },
      { age: '70대 이상',   value: d.seventy  || 0 },
    ];

    const fullW  = chartEl.node().clientWidth || 420;
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const width  = fullW - margin.left - margin.right;
    const height = 260  - margin.top  - margin.bottom;

    const svg = chartEl.append('svg')
      .attr('width', fullW)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(ageData.map(d => d.age))
                  .range([0, width]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(ageData, d => d.value) * 1.1 || 1])
                  .range([height, 0]);

    g.append('g').attr('transform', `translate(0,${height})`)
                 .call(d3.axisBottom(x))
                 .selectAll('text').attr('transform', 'rotate(-40)').style('text-anchor', 'end');
    g.append('g').call(d3.axisLeft(y).ticks(4));

    g.selectAll('rect').data(ageData).enter().append('rect')
      .attr('x', d => x(d.age))
      .attr('y', d => y(d.value))
      .attr('width',  x.bandwidth())
      .attr('height', d => height - y(d.value))
      .attr('fill', '#69b3a2');
  }

  /* ▶▶ 변경된 부분: 도넛형 Feature Importance ───────────────────────────── */
  /* ───────── Feature Importance → 도넛형 ───────── */
function renderDonut () {
  const box = d3.select(featureChartRef.current);
  box.selectAll('*').remove();

  /* ▼ 레이아웃 파라미터 */
  const fullW   = box.node().clientWidth;          // 현재 info-box 폭 (560px)
  const margin  = { top: 20, right: 20, bottom: 20, left: 20 };
  const legendW = 200;                             // 범례 폭
  const donutSz = Math.min(320, fullW - margin.left - margin.right - legendW);
  const R       = donutSz / 2;

  /* SVG 전체 크기 = 도넛 + legend + 여백 */
  const svg = box.append('svg')
    .attr('width',  donutSz + legendW + margin.left + margin.right)
    .attr('height', donutSz + margin.top + margin.bottom);

  /* ── ① 도넛 (왼쪽) ───────────────────────────── */
  const gDonut = svg.append('g')
    .attr('transform',
      `translate(${margin.left + R},${margin.top + R})`);

  const color = d3.scaleOrdinal()
    .domain(featureImportanceData.map(d => d.feature))
    .range(d3.schemeTableau10);

  const pie = d3.pie().sort(null).value(d => d.importance);
  const arc = d3.arc().innerRadius(R * 0.55).outerRadius(R);

  gDonut.selectAll('path')
    .data(pie(featureImportanceData))
    .enter().append('path')
    .attr('d', arc)
    .attr('fill', d => color(d.data.feature))
    .attr('stroke', '#000').attr('stroke-width', 0.3);

  /* ── ② 범례 (오른쪽) ─────────────────────────── */
  const gLegend = svg.append('g')
    .attr('transform',
      `translate(${margin.left + donutSz + 30},${margin.top})`);

  gLegend.selectAll('g')
    .data(pie(featureImportanceData))
    .enter().append('g')
    .attr('transform', (d, i) => `translate(0, ${i * 18})`)
    .each(function(d){
      const g = d3.select(this);
      g.append('rect')
        .attr('width', 12).attr('height', 12)
        .attr('fill',  color(d.data.feature));
      g.append('text')
        .attr('x', 18).attr('y', 10)
        .text(`${d.data.feature} (${d3.format('.1%')(d.data.importance)})`)
        .attr('fill', '#fff')
        .style('font-size', '12px');
    });
}

  function clearSelectedChart() {
    d3.select(selectedChartRef.current).selectAll('*').remove();
  }

  /* ────────────────────────── JSX ────────────────────────── */
  return (
    <main className="main-content">
      <h1>GeoJSON Grid Map</h1>

      <div className="content-flex">
        {/* 지도 */}
        <div className="map-wrapper" style={{ position: 'relative' }}>
          <div id="map" style={{ width: 800, height: 600 }}></div>
          <svg ref={svgRef} style={{ position: 'absolute', top: 0, left: 0 }}></svg>
        </div>

        {/* 우측 패널 */}
        <div className="info-container" style={{ position: 'relative', zIndex: 999 }}>
          <div className="info-box">
            <h2>선택한 격자 데이터</h2>
            {gridData
              ? <div ref={selectedChartRef} className="bar-chart"></div>
              : <p>격자를 선택하면 데이터가 표시됩니다.</p>}
          </div>

          <div className="info-box">
            <h2>Feature Importance</h2>
            <div ref={featureChartRef} className="feature-bar-chart"></div>
          </div>
        </div>
      </div>
    </main>
  );
};
export default Dataset;

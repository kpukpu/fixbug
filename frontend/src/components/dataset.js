/* ───────────── src/components/Dataset.js ───────────── */
import React, { useEffect, useRef, useState } from 'react';
import L   from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import './dataset.css';

const Dataset = () => {
  /* ===== refs & state ===== */
  const svgRef            = useRef(null);
  const selectedChartRef  = useRef(null);
  const featureChartRef   = useRef(null);
  const dragStartRef      = useRef(null);     // ← 클릭 vs 드래그 판별
  const [gridData, setGridData] = useState(null);

  /* ===== Feature-Importance 원본 데이터 ===== */
const featureImportanceData = [
  { feature:'소상공인 업종 합계'            , percent:12 },
  { feature:'위도'                         , percent:10 },
  { feature:'토지 면적 합계'               , percent:10 },
  { feature:'토지 면적 평균'               , percent:10 },
  { feature:'소상공인 소매 합계'           , percent: 8 },
  { feature:'35년 이상 건축물수 합계'      , percent: 7 },
  { feature:'토지 공시지가 평균'           , percent: 7 },
  { feature:'토지 지목수 합계'             , percent: 7 },
  { feature:'토지필지수 합계'              , percent: 7 },
  { feature:'소상공인 음식 합계'           , percent: 5 },
  { feature:'대지 합계'                    , percent: 5 },
  { feature:'식물 재배 토지 합계'          , percent: 4 },
  { feature:'25년~29년 건축물수 합계'      , percent: 3 },
  { feature:'30대 인구수'                 , percent: 3 },
  { feature:'유아 인구수'                 , percent: 2 },
];


  /* ───────── helper: Leaflet 범례 ───────── */
  const addLegendTo = (map) => {
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="legend-item">
          <span style="background:#00ff00"></span>
          실제 민원 발생 – 예측 성공
        </div>
        <div class="legend-item">
          <span style="background:#9b111e"></span>
          실제 민원 발생 – 예측 실패
        </div>
        <div class="legend-item">
          <span style="background:#0000ff"></span>
          실제 민원 미발생 – 발생 예측
        </div>`;
      return div;
    };
    legend.addTo(map);
  };

  /* ───────────────── Leaflet + D3 초기화 ───────────────── */
  useEffect(() => {
    const gridSize = 0.001; // 100 m
    /* ── ① Leaflet 지도 ── */
    const map = L.map('map', {
      center:[36.35,127.38],
      zoom  :12,
      layers:[L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution:'© OpenStreetMap contributors' }
      )],
    });
    addLegendTo(map); 
    /* ── ② SVG 오버레이 ── */
    map.getPanes().overlayPane.appendChild(svgRef.current);
    const svg = d3.select(svgRef.current)
                  .style('position','absolute')
                  .style('z-index',999)
                  .style('pointer-events','none');
    svg.selectAll('*').remove();

    /* ── ③ 데이터 로드 ── */
    (async () => {
      try{
        const [csvData, daejeonData, seoGuData] = await Promise.all([
          d3.csv(`${process.env.PUBLIC_URL}/data/ssookssook.csv`),
          d3.json(`${process.env.PUBLIC_URL}/data/daejeon.geojson`),
          d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`)
        ]);

        if(!daejeonData?.features || !seoGuData?.features)
          throw new Error('GeoJSON 데이터가 비었습니다.');

        /* 예측 / 실제 매핑 */
        const valueMap = {};
        csvData.forEach(r=>{
          const lat=+r.위도, lng=+r.경도;
          valueMap[align([lng,lat]).join(',')] = {
            actual :+r.실제값 || 0,
            predict:+r.예측값 || 0
          };
        });

        /* ── ④ D3 그리기 ── */
        const g = svg.append('g');

        /* 대전 외곽선 */
        const border = g.append('path')
          .attr('fill','none')
          .attr('stroke','#999')
          .attr('stroke-width',1)
          .style('pointer-events','none');

        /* 100 m 격자 */
        const cells = g.selectAll('rect')
          .data(seoGuData.features.filter(f=>f.geometry?.coordinates))
          .enter().append('rect')
          .attr('stroke','#000')
          .attr('stroke-width',0.1)
          .style('pointer-events','all')
          .style('opacity',0.7)
          .attr('fill',d=>{
            const key=align(d.geometry.coordinates).join(',');
            const v=valueMap[key]||{actual:0,predict:0};
            return color(v.actual,v.predict);
          })
          /* ─ Hover ─ */
          .on('mouseover',function(){d3.select(this).attr('fill','#ffcc00').style('opacity',1);})
          .on('mouseout' ,function(e,d){
            const key=align(d.geometry.coordinates).join(',');
            const v=valueMap[key]||{actual:0,predict:0};
            d3.select(this).attr('fill',color(v.actual,v.predict)).style('opacity',0.7);
          })
          /* ─ 클릭 vs 드래그 ─ */
          .on('mousedown',e=>{
            dragStartRef.current=[e.clientX,e.clientY];
          })
          .on('mouseup',(e,d)=>{
            if(!dragStartRef.current) return;
            const [x0,y0]=dragStartRef.current;
            dragStartRef.current=null;
            const dx=e.clientX-x0, dy=e.clientY-y0;
            if(dx*dx+dy*dy>25) return;          // 5 px 이상 이동 → 드래그

            /* 실제 클릭 ⇒ 줌인 + 백엔드 호출 */
            const [lng,lat]=d.geometry.coordinates;
            map.setView([lat,lng],15);
            sendToBackend([lng,lat]);
          });

        /* ── 위치 & 크기 업데이트 ── */
        const update = ()=>{
          const b = map.getBounds(),
                tl= map.latLngToLayerPoint(b.getNorthWest()),
                br= map.latLngToLayerPoint(b.getSouthEast());

          svg.attr('width',br.x-tl.x)
             .attr('height',br.y-tl.y)
             .style('left',`${tl.x}px`)
             .style('top' ,`${tl.y}px`);
          g.attr('transform',`translate(${-tl.x},${-tl.y})`);

          /* 셀 위치·크기 재계산 */
          cells
            .attr('x',d=>map.latLngToLayerPoint([d.geometry.coordinates[1],d.geometry.coordinates[0]]).x)
            .attr('y',d=>map.latLngToLayerPoint([d.geometry.coordinates[1],d.geometry.coordinates[0]]).y)
            .attr('width', d=>{
              const [lng,lat]=d.geometry.coordinates;
              const p1=map.latLngToLayerPoint([lat,lng]);
              const p2=map.latLngToLayerPoint([lat+gridSize,lng+gridSize]);
              return p2.x-p1.x;
            })
            .attr('height',d=>{
              const [lng,lat]=d.geometry.coordinates;
              const p1=map.latLngToLayerPoint([lat,lng]);
              const p2=map.latLngToLayerPoint([lat+gridSize,lng+gridSize]);
              return p1.y-p2.y;
            });

          /* 외곽선 경로 */
          const coords = (daejeonData.features[0].geometry.type==='MultiPolygon')
            ? daejeonData.features[0].geometry.coordinates[0][0]
            : daejeonData.features[0].geometry.coordinates[0];

          border.attr('d',d3.line()(coords.map(([lng,lat])=>{
            const p=map.latLngToLayerPoint([lat,lng]);
            return [p.x,p.y];
          })));
        };
        map.on('moveend zoomend',update);
        update();
        /* ── Helper ── */

        function align([lng,lat]){
          return [Math.floor(lng/gridSize)*gridSize,
                  Math.floor(lat/gridSize)*gridSize];
        }
        function color(a,p){
          if(a&&p)   return '#00ff00';
          if(a&&!p)  return '#9b111e';
          if(!a&&p)  return '#0000ff';
          return '#ffffff';
        }
        async function sendToBackend([lng,lat]){
          try{
            const res = await fetch('http://13.124.192.99:8000/api/get_xy/',{
              method :'POST',
              headers:{'Content-Type':'application/json'},
              body   :JSON.stringify({longitude:lng,latitude:lat}),
            });
            if(res.ok){
              const {data}=await res.json();
              setGridData(data[0]);
            }else console.error('백엔드 요청 실패:',res.status);
          }catch(err){ console.error('통신 에러:',err); }
        }
      }catch(err){ console.error('데이터 로드 오류:',err); }
    })();

    /* cleanup */
    return ()=>map.remove();
  }, []);

  /* ───── 선택 격자 → 연령 막대모음 ───── */
  useEffect(()=>{
    gridData ? renderSelectedChart(gridData)
             : clearSelectedChart();
  },[gridData]);

  /* ───── 최초 한 번 Feature Importance 도넛 ───── */
  useEffect(()=>{ renderDonut(); },[]);

  /* ---------- renderSelectedChart ---------- */
  function renderSelectedChart(d){
    const el = d3.select(selectedChartRef.current);
    el.selectAll('*').remove();

    const ageData = [
      {age:'유아'     , value:d.realkid || 0},
      {age:'초등학생' , value:d.element || 0},
      {age:'중학생'   , value:d.middle  || 0},
      {age:'고등학생' , value:d.high    || 0},
      {age:'20대'     , value:d.twenty  || 0},
      {age:'30대'     , value:d.thirty  || 0},
      {age:'40대'     , value:d.fourty  || 0},
      {age:'50대'     , value:d.fifty   || 0},
      {age:'60대'     , value:d.sixty   || 0},
      {age:'70대 이상', value:d.seventy || 0},

    ];

    const fullW  = el.node().clientWidth || 420;
    const m      = {top:20,right:20,bottom:60,left:60};
    const W      = fullW-m.left-m.right;
    const H      = 260 - m.top - m.bottom;

    const svg = el.append('svg')
                  .attr('width',fullW)
                  .attr('height',H+m.top+m.bottom);
    const g   = svg.append('g')
                   .attr('transform',`translate(${m.left},${m.top})`);

    const x = d3.scaleBand().domain(ageData.map(d=>d.age))
                 .range([0,W]).padding(0.25);
    const y = d3.scaleLinear().domain([0,d3.max(ageData,d=>d.value)*1.1||1])
                 .range([H,0]);

    g.append('g')
      .attr('transform',`translate(0,${H})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform','rotate(-40)')
      .style('text-anchor','end');
    g.append('g').call(d3.axisLeft(y).ticks(4));

    g.selectAll('rect')
      .data(ageData)
      .enter().append('rect')
      .attr('x',d=>x(d.age))
      .attr('y',d=>y(d.value))
      .attr('width',x.bandwidth())
      .attr('height',d=>H - y(d.value))
      .attr('fill','#69b3a2');
  }
  function clearSelectedChart(){
    d3.select(selectedChartRef.current).selectAll('*').remove();
  }

  /* ---------- Feature-Importance 도넛 ---------- */
function renderDonut () {
  const box   = d3.select(featureChartRef.current);
  box.selectAll('*').remove();

  const fullW = box.node().clientWidth;                   // info-box 실제 폭
  const padL = parseFloat(getComputedStyle(box.node()).paddingLeft)  || 0;
  const padR = parseFloat(getComputedStyle(box.node()).paddingRight) || 0;
  const innerW = fullW - padL - padR;   // ← 실제 그릴 수 있는 폭
  const m     = { top:20, right:20, bottom:20, left:20 };

  /* 레이아웃 기준 */
  const legendW   = 200;   // 범례 폭
  const gap       = 30;    // 도넛-범례 사이 간격
  const donutMax  = 320;   // 도넛 최대 지름
  const marginLR  = m.left + m.right + 10;  // 좌우 여유

  /* 폭이 좁으면 범례를 아래로 */
  const legendBelow = fullW < donutMax + legendW + gap + marginLR;

  /* 도넛 지름 계산 (최소 160px 보장) */
  let donutSz = Math.min(
    donutMax,
    fullW - m.left - m.right - (legendBelow ? 0 : legendW + gap)
  );
  donutSz = Math.max(160, donutSz);
  const R = donutSz / 2;

  /* 전체 SVG 크기 */
  const svg = box.append('svg')
    .attr('width', fullW)
    .attr('height',
      legendBelow
        ? donutSz + m.top + m.bottom + 200   /* 범례가 아래쪽 */
        : donutSz + m.top + m.bottom
    )
    .style('max-width', '100%')
    .style('height', 'auto');

  /* ── 도넛 그룹 위치 (가로 중앙 정렬) ── */
  const totalW = legendBelow ? donutSz : donutSz + gap + legendW;
  const offsetX = (fullW - totalW) / 2 + R;

  const gDonut = svg.append('g')
    .attr('transform', `translate(${offsetX},${m.top + R})`);

  /* 색상・아크 */
  const color = d3.scaleOrdinal()
    .domain(featureImportanceData.map(d => d.feature))
    .range(d3.schemeTableau10);

  const pie = d3.pie()
                .sort(null)
                .value(d => d.percent);

  const arc = d3.arc()
                .innerRadius(R * 0.55)
                .outerRadius(R);

  /* ── 도넛 ── */
  const paths = gDonut.selectAll('path')
    .data(pie(featureImportanceData))
    .enter().append('path')
    .attr('d', arc)
    .attr('fill', d => color(d.data.feature))
    .attr('stroke', '#000')
    .attr('stroke-width', 0.3);

  /* ✅ 각 조각 위에 % 라벨 찍기 */
  gDonut.selectAll('text.slice-label')
    .data(pie(featureImportanceData))
    .enter().append('text')
    .attr('class','slice-label')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('dy','0.35em')
    .attr('text-anchor','middle')
    .style('font-size','999x')
    .style('fill','#fff')
    .style('pointer-events','none')
    .text(d => `${d.data.percent}%`);

  /* ── 범례 ── */
  const gL = svg.append('g')
    .attr('transform',
      legendBelow
        ? `translate(${(fullW - legendW) / 2},${m.top + donutSz + 20})`
        : `translate(${offsetX + R + gap},${m.top})`
    );
  const legendSpacing = 24; 

  gL.selectAll('g')
    .data(pie(featureImportanceData))
    .enter().append('g')
    .attr('transform', (d, i) => `translate(0,${i * 18})`)
    .attr('transform', (d, i) => `translate(0,${i * legendSpacing})`)
    .each(function (d) {
      const g = d3.select(this);
      g.append('rect')
        .attr('width', 12).attr('height', 12)
        .attr('fill', color(d.data.feature));
      g.append('text')
        .attr('x', 18).attr('y', 10)
        .text(`${d.data.feature} (${d.data.percent}%)`)   /* ← % 표기 */
        .attr('fill', '#fff')
        .style('font-size', '19px');
    });
}


  /* ───────────────────────── JSX ───────────────────────── */
  return(
    <main className="main-content">
      <h1>15~20년 기반 해충 민원 발생 공간 예측</h1>

      <div className="content-flex">
        {/* 지도 */}
        <div className="map-wrapper" style={{position:'relative'}}>
          <div id="map" style={{width:800,height:600}}></div>
          <svg ref={svgRef} style={{position:'absolute',top:0,left:0}}></svg>
        </div>

        {/* 우측 패널 */}
        <div className="info-container" style={{position:'relative',zIndex:999}}>
          <div className="info-box">
            <h2>선택한 격자 인구 데이터</h2>
            {gridData ? (
     <>
       {/* ── 메타 정보 표시 ── */}
       <div className="grid-meta">
         <b>행정동명&nbsp;:&nbsp;</b>{gridData.h_area || '-'}<br/>
        <b>법정동명&nbsp;:&nbsp;</b>{gridData.b_area    || '-'}<br/>
         <b>기초구역명&nbsp;:&nbsp;</b>{gridData.g_area    || '-'}<br/>
         <b>100 m 격자&nbsp;:&nbsp;</b>{gridData.grid_100 || '-'}
       </div>

       {/* 막대그래프 자리 */}
       <div ref={selectedChartRef} className="bar-chart"></div>
     </>
   ) : (
     <p>격자를 선택하면 인구 정보가 표시됩니다.</p>
   )}
          </div>

          <div className="info-box">
            <h2>해충 민원 발생 주요 원인</h2>
            <div ref={featureChartRef} className="feature-bar-chart"></div>
          </div>
        </div>
      </div>
    </main>
  );
};
export default Dataset;

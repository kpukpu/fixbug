// ───────────── src/components/OurProject.js ─────────────
import React, { useEffect, useRef, useState } from 'react';
import L   from 'leaflet';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import './ourproject.css';

export default function OurProject() {
  /* ===== 상수 ===== */
  const GRID_OPACITY  = 0.95;
  const DONG_OPACITY  = 0.45;
  const HIGHLIGHT_COLOR = '#FFCA1A';
  const GRID         = 0.001;        // ≒ 100 m
  const Z_DONG       = 13;
  const Z_GRID       = 15;
  const MONTHS       = [6,7,8,9,10];
  const INITIAL_MONTH = 6;

  /* ===== refs / state ===== */
  const svgRef        = useRef(null);
  const lastHiddenRef = useRef(null);
  const chartRef      = useRef(null);
  const mapRef        = useRef(null);
  const gridLayerRef  = useRef(null);
  const dongLayerRef  = useRef(null);
  const dongGeoRef    = useRef(null);
  const gridGeoRef    = useRef(null);
  const dongGridRef   = useRef([]);   // 행정동 → 격자 index 배열
  const valRef        = useRef({});   // {lng,lat:{a,p}}
  const loadCsvRef    = useRef(null);
  const downPtRef     = useRef(null);

  const [month,      setMonth]      = useState(INITIAL_MONTH);
  const [showActual, setShowActual] = useState(true);

  /* ===== 보조 함수 ===== */
  const snap = ([x,y]) => [Math.floor(x/GRID)*GRID, Math.floor(y/GRID)*GRID];
  const origin = f => {
    if(!f?.geometry) return [0,0];
    const g=f.geometry;
    if(g.type==='Point')        return g.coordinates;
    if(g.type==='Polygon')      return g.coordinates[0][0];
    if(g.type==='MultiPolygon') return g.coordinates[0][0][0];
    return [0,0];
  };
  const rev = ([x,y]) => [y,x];

  const tpColor='#00FF00', fnColor='#9b111e', fpColor='#0000FF';

  const csvPath = m =>
    `${process.env.PUBLIC_URL}/data/ssookssook_${String(m).padStart(2,'0')}.csv`;

  const baseColorF = (a,p)=>
    a&&p ? tpColor : a&&!p ? fnColor : !a&&p ? fpColor : '#ffffff';

  /* ───────── 격자 색만 다시 칠하기 ───────── */
  const recolorGrid = (actualOn=showActual)=>{
    if(!gridLayerRef.current||!gridGeoRef.current) return;

    gridLayerRef.current
      .selectAll('rect')
      .attr('fill',f=>{
        const k=snap(origin(f)).join(',');
        const v=valRef.current[k]||{a:0,p:0};
        if(actualOn&&v.a) return HIGHLIGHT_COLOR;
        return baseColorF(v.a,v.p);
      })
      .attr('fill-opacity',f=>{
        const k=snap(origin(f)).join(',');
        const v=valRef.current[k]||{a:0};
        return actualOn&&v.a ? 1 : GRID_OPACITY;
      });
  };

  /* ───────────────────────── 초기화 ───────────────────────── */
  useEffect(()=>{
    /* ① Leaflet */
    const map=L.map('map',{
      center:[36.348,127.376],
      zoom:Z_DONG,
      layers:[L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {attribution:'© OpenStreetMap contributors'}
      )],
    });
    mapRef.current=map;

    /* ② 범례 */
    const legend=L.control({position:'bottomright'});
    legend.onAdd=()=>{
      const d=L.DomUtil.create('div','legend');
      d.innerHTML=`<h4 style="margin:0 0 4px;">민원 발생률 높음</h4>
        <div class="spectrum-bar"></div>
        <div class="legend-txt"><span>민원 발생률 낮음</span></div>`;
      return d;
    };
    legend.addTo(map);

    /* ③ SVG */
    if(!svgRef.current)
      svgRef.current=document.createElementNS('http://www.w3.org/2000/svg','svg');
    map.getPanes().overlayPane.appendChild(svgRef.current);
    const svg=d3.select(svgRef.current).style('position','absolute');

    const g         = svg.append('g');
    const gridLayer = g.append('g').style('pointer-events','none');
    const dongLayer = g.append('g');
    gridLayerRef.current=gridLayer;
    dongLayerRef.current=dongLayer;

    /* ④ GeoJSON + CSV */
    Promise.all([
      d3.json(`${process.env.PUBLIC_URL}/data/dong.geojson`),
      d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`)
    ]).then(([dongGeo,gridGeo])=>{
      dongGeoRef.current=dongGeo;
      gridGeoRef.current=gridGeo;

      /* 행정동 ↔ 격자 인덱스 */
      dongGridRef.current=dongGeo.features.map(()=>[]);
      gridGeo.features.forEach((gf,gi)=>{
        const cen=d3.geoCentroid(gf);
        dongGeo.features.forEach((df,di)=>{
          if(d3.geoContains(df,cen)) dongGridRef.current[di].push(gi);
        });
      });

      drawGrid();
      drawDong();
      loadCsv(INITIAL_MONTH);
    });

    /* ───────── drawGrid ───────── */
    function drawGrid(){
      gridLayer.selectAll('rect')
        .data(gridGeoRef.current.features)
        .enter().append('rect')
        .attr('stroke','#000')
        .attr('stroke-width',0.1)
        .attr('fill',baseColorF(0,0))
        .attr('fill-opacity',GRID_OPACITY);
      updatePos();
    }

    /* ───────── drawDong ───────── */
    function drawDong(){
      dongLayer.selectAll('path')
        .data(dongGeoRef.current.features)
        .enter().append('path')
        .attr('data-di',(_,i)=>i)
        .attr('fill','#b1b4e2')
        .attr('fill-opacity',DONG_OPACITY)
        .style('pointer-events','all')
        .attr('stroke','#000')
        .attr('stroke-width',1)
        .on('mouseover',function(){d3.select(this).attr('fill','#d3d3d3');})
        .on('mouseout',function(){d3.select(this).attr('fill',d3.select(this).attr('data-prev'));})
        .on('mousedown',e=>{downPtRef.current=[e.clientX,e.clientY];})
        .on('mouseup',function(e,f){
          if(!downPtRef.current) return;
          const [x0,y0]=downPtRef.current;
          const dx=e.clientX-x0, dy=e.clientY-y0;
          downPtRef.current=null;
          if(dx*dx+dy*dy>25) return;      // 드래그 무시
          showDongInfo(f,this);
        });
      updatePos();
    }

    function showDongInfo(dongF, elem) {
  /* ① 다른 동 되살리기 */
  if (lastHiddenRef.current)
    d3.select(lastHiddenRef.current).style('display', null);
  d3.select(elem).style('display', 'none');
  lastHiddenRef.current = elem;

  const dongIdx = +elem.getAttribute('data-di');
  const inside  = dongGridRef.current[dongIdx];

  /* ② 파란 격자(FP)만 카운트 */
  let blueCnt = 0;
  inside.forEach(idx => {
    const f = gridGeoRef.current.features[idx];
    const k = snap(origin(f)).join(',');
    const v = valRef.current[k] || { a: 0, p: 0 };
    if (!v.a && v.p) blueCnt += 1;           // ← 파란 격자만 +
  });

  /* ③ 파란 격자 비율로 위험도 결정 */
  const ratio = inside.length ? blueCnt / inside.length : 0;
  let level   = 'blue';                      // 기본 안전
  if (ratio >= 0.07)      level = 'red';
  else if (ratio >= 0.03) level = 'purple';

  /* ④ 지도 줌인 → 행정동 중심 */
  const [lng, lat] = d3.geoCentroid(dongF);
  map.setView([lat, lng], Z_GRID);

  /* ⑤ InfoBox 출력 */
  drawHazardBox(level, blueCnt);
}

    /* ───────── InfoBox 그리기 ───────── */
    function drawHazardBox(level,cnt){
      const wrap=d3.select(chartRef.current);
      wrap.selectAll('*').remove();

      /* 메시지 사전 */
      const dict={
        red   :{title:'위험', icon:'🚨', color:'#ff4d4d',
                desc2:'해충 방역 필요'},
        purple:{title:'경고', icon:'⚠️', color:'#ffbf00',
                desc2:'해충 방역 권고'},
        blue  :{title:'안전', icon:'👍', color:'#4da6ff',
                desc2:'해충 민원 발생률이 저조합니다!'}
      };
      const d=dict[level];

      wrap.append('div')
        .style('display','flex')
        .style('flex-direction','column')
        .style('align-items','center')
        .style('gap','12px')
        .html(`
          <div style="font-size:34px;font-weight:700;color:${d.color}">${d.title}</div>
          <div style="font-size:54px">${d.icon}</div>
          <div style="font-size:22px">해충 민원 발생 <b>${cnt}</b>건</div>
          <div style="font-size:18px">${d.desc2}</div>
        `);
    }

    /* ───────── 위치 보정 ───────── */
    function updatePos(){
      const b=map.getBounds(),
            tl=map.latLngToLayerPoint(b.getNorthWest()),
            br=map.latLngToLayerPoint(b.getSouthEast());

      d3.select(svgRef.current)
        .attr('width',br.x-tl.x)
        .attr('height',br.y-tl.y)
        .style('left',`${tl.x}px`)
        .style('top' ,`${tl.y}px`);
      g.attr('transform',`translate(${-tl.x},${-tl.y})`);

      /* path */
      if(dongGeoRef.current){
        const geoPath=d3.geoPath().projection(
          d3.geoTransform({
            point(x,y){
              const p=map.latLngToLayerPoint([y,x]);
              /* @ts-ignore */
              this.stream.point(p.x,p.y);
            }
          })
        );
        dongLayer.selectAll('path').attr('d',geoPath);
      }

      /* rect */
      gridLayer.selectAll('rect')
        .attr('x',f=>map.latLngToLayerPoint(rev(origin(f))).x)
        .attr('y',f=>map.latLngToLayerPoint(rev(origin(f))).y)
        .attr('width',f=>{
          const [x,y]=origin(f);
          const p1=map.latLngToLayerPoint([y,x]);
          const p2=map.latLngToLayerPoint([y+GRID,x+GRID]);
          return p2.x-p1.x;
        })
        .attr('height',f=>{
          const [x,y]=origin(f);
          const p1=map.latLngToLayerPoint([y,x]);
          const p2=map.latLngToLayerPoint([y+GRID,x+GRID]);
          return p1.y-p2.y;
        });
    }
    map.on('moveend zoomend',updatePos);

    /* ───────── 행정동 색상 초기화 ───────── */
    function updateDongColors(){
      const ratios=dongGridRef.current.map(arr=>{
        if(!arr.length) return 0;
        let predicted=0;
        arr.forEach(idx=>{
          const k=snap(origin(gridGeoRef.current.features[idx])).join(',');
          const v=valRef.current[k]||{p:0};
          if(v.p) predicted+=1;
        });
        return predicted/arr.length;
      });

      const colorScale=d3.scaleLinear()
        .domain([0,0.1])
        .range(['#0000FF','#FF0000']);

      dongLayer.selectAll('path')
        .attr('fill',function(_,i){
          const c=colorScale(ratios[i]);
          d3.select(this).attr('data-prev',c);
          return c;
        })
        .attr('fill-opacity',DONG_OPACITY);
    }

    /* ───────── CSV 로드 ───────── */
    function loadCsv(m){
      d3.csv(csvPath(m)).then(csv=>{
        const tmp={};
        csv.forEach(r=>{
          const k=snap([+r.경도,+r.위도]).join(',');
          tmp[k]={a:+r.실제값||0,p:+r.예측값||0};
        });
        valRef.current=tmp;
        recolorGrid();        // 격자 색 초기화
        updateDongColors();   // 행정동 색 초기화
      });
    }
    loadCsvRef.current=loadCsv;

    /* ⑥ 첫 화면용 InfoBox 기본 메시지 */
    drawHazardBox('blue',0);

    return ()=>map.remove();
  },[]);    // ← 최초 1회

  /* 격자/민원 ON·OFF 토글 */
  useEffect(()=>{ recolorGrid(showActual); },[showActual]);

  /* 월 바뀌면 CSV 다시 읽기 */
  useEffect(()=>{ if(loadCsvRef.current) loadCsvRef.current(month); },[month]);

  /* ─────────── JSX ─────────── */
  return(
    <div className="main-container">
      <h1>20년도&nbsp;→&nbsp;월별&nbsp;해충&nbsp;방역지&nbsp;추천</h1>

      <div className="month-selector">
        {MONTHS.map(m=>(
          <button key={m}
                  className={m===month?'active':''}
                  onClick={()=>setMonth(m)}>
            {m}월
          </button>
        ))}
        <button style={{marginLeft:'1rem'}}
                onClick={()=>setShowActual(v=>!v)}>
          기존 민원 발생지 {showActual?'ON':'OFF'}
        </button>
      </div>

      <div className="content-flex">
        <div className="map-wrapper">
          <div id="map" />
        </div>

        {/* InfoBox 카드 */}
        <div className="chart-wrapper info-box">
          <div ref={chartRef}
               style={{width:'100%',display:'flex',justifyContent:'center'}} />
        </div>
      </div>
    </div>
  );
}

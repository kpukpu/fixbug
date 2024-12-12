// Dataset.js
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './dataset.css';
import 'leaflet/dist/leaflet.css';

const Dataset = () => {
  const svgRef = useRef(null); 
  const selectedChartRef = useRef(null); 
  const featureChartRef = useRef(null); 
  const [gridData, setGridData] = useState(null); 

  // Feature Importance 데이터 정의
  const featureImportanceData = [
    { feature: '위도', importance: 0.2032174616968298 },
    { feature: '경도', importance: 0.16670527622852893 },
    { feature: '평균_토지_공시지가', importance: 0.048534008 },
    { feature: '평균_토지_면적', importance: 0.035985845188414405 },
    { feature: '합계_토지_면적', importance: 0.035915545 },
    { feature: '평균_토지대장_공시지가', importance: 0.03382206 },
    { feature: '합계_토지필지수', importance: 0.018259208 },
    { feature: '합계_토지_지목수_계', importance: 0.017903365 },
    { feature: '인구_연령_20대', importance: 0.017359783796625047 },
    { feature: '합계_토지_지목수_전', importance: 0.015415886802757003 },
    { feature: '인구_연령_40대', importance: 0.014241199 },
    { feature: '합계_토지_지목수_구거', importance: 0.014235885155369579 },
    { feature: '최대_건축물_사용승인일', importance: 0.013660690780757772 },
    { feature: '인구_연령_30대', importance: 0.012676483816991647 },
    { feature: '평균_건물_일반_지상층수', importance: 0.012559764048248817 },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const svg = d3.select(svgRef.current);
      const width = 800;
      const height = 600;
      const gridSize = 0.001;

      svg.attr('width', width).attr('height', height);
      svg.selectAll('*').remove();

      try {
        // CSV 데이터 로드
        const csvData = await d3.csv(`${process.env.PUBLIC_URL}/data/ssookssook.csv`);
        // 예: csvData = [ 
        //   { "격자순번": "1", "격자100m": "다마84999", "위도": "36.19387", "경도": "127.3304", "실제값": "0", "예측값": "1" }, ...
        // ]

        const valueMap = {};
        csvData.forEach(row => {
          const lat = parseFloat(row["위도"]);
          const lng = parseFloat(row["경도"]);
          const actualVal = parseInt(row["실제값"], 10) || 0;
          const predictVal = parseInt(row["예측값"], 10) || 0;

          const aligned = alignToGrid([lng, lat], gridSize); 
          const key = aligned.join(',');
          valueMap[key] = { actual: actualVal, predict: predictVal };
        });

        const daejeonData = await d3.json(`${process.env.PUBLIC_URL}/data/daejeon.geojson`);
        const seoGuData = await d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`);

        if (!daejeonData?.features || !seoGuData?.features) {
          throw new Error('GeoJSON 데이터가 비어 있습니다.');
        }

        const projection = d3.geoMercator().fitSize([width, height], daejeonData);
        const pathGenerator = d3.geoPath().projection(projection);

        const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', zoomed);
        function zoomed(event) {
          g.attr('transform', event.transform);
        }

        svg.call(zoom);

        svg
          .append('rect')
          .attr('width', width)
          .attr('height', height)
          .style('fill', 'none')
          .style('pointer-events', 'all');

        const g = svg.append('g');

        // 대전시 지도
        g.selectAll('.daejeon')
          .data(daejeonData.features)
          .enter()
          .append('path')
          .attr('class', 'daejeon')
          .attr('d', pathGenerator)
          .attr('fill', '#cccccc')
          .attr('stroke', '#999999')
          .attr('stroke-width', 0.5);

        // 서구 격자
        const gridCells = seoGuData.features.filter(d => d.geometry && d.geometry.coordinates);

        g.selectAll('.grid-cell')
          .data(gridCells)
          .enter()
          .append('rect')
          .attr('class', 'grid-cell')
          .attr('x', (d) => {
            const aligned = alignToGrid(projection.invert(projection(d.geometry.coordinates)), gridSize);
            return projection(aligned)[0];
          })
          .attr('y', (d) => {
            const aligned = alignToGrid(projection.invert(projection(d.geometry.coordinates)), gridSize);
            return projection(aligned)[1];
          })
          .attr('width', () => {
            const [x1] = projection([gridSize, 0]);
            const [x0] = projection([0, 0]);
            return x1 - x0;
          })
          .attr('height', () => {
            const [, y1] = projection([0, gridSize]);
            const [, y0] = projection([0, 0]);
            return y0 - y1;
          })
          .attr('stroke', '#b1e7db')   
          .attr('stroke-width', 0.05) 
          .attr('fill', (d) => {
            const aligned = alignToGrid(projection.invert(projection(d.geometry.coordinates)), gridSize);
            const key = aligned.join(',');
            const vals = valueMap[key] || {actual:0, predict:0};
            return getColor(vals.actual, vals.predict);
          })
          .on('mouseover', function (event, d) {
            d3.select(this).attr('fill', '#ffcc00');
          })
          .on('mouseout', function (event, d) {
            const aligned = alignToGrid(projection.invert(projection(d.geometry.coordinates)), gridSize);
            const key = aligned.join(',');
            const vals = valueMap[key] || {actual:0, predict:0};
            d3.select(this).attr('fill', getColor(vals.actual, vals.predict));
          })
          .on('click', function (event, d) {
            if (!d.geometry || !d.geometry.coordinates) {
              console.error('Invalid geometry:', d.geometry);
              return;
            }
            const coords = projection.invert(projection(d.geometry.coordinates));
            console.log('Computed coordinates:', coords);
            zoomToFeature(d);
            sendCoordinatesToBackend(coords);
          });

        function alignToGrid(coordinates, gridSize) {
          const [lng, lat] = coordinates; 
          const x = Math.floor(lng / gridSize) * gridSize;
          const y = Math.floor(lat / gridSize) * gridSize;
          return [x, y];
        }

        function getColor(actual, predict) {
          if (actual === 1 && predict === 1) {
            return '#00FF00'; // 초록
          } else if (actual === 1 && predict === 0) {
            return '#9b111e'; // 빨강
          } else if (actual === 0 && predict === 1) {
            return '#0000FF'; // 파랑
          } else {
            return '#ffffff'; // 둘다 0이면 흰색
          }
        }

        async function sendCoordinatesToBackend(coords) {
          try {
            if (!coords || coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
              console.error('Invalid coordinates:', coords);
              return;
            }
            const response = await fetch('http://127.0.0.1:8000/api/get_xy/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                longitude: coords[0],
                latitude: coords[1],
              }),
            });

            if (response.ok) {
              const data = await response.json();
              console.log('백엔드 응답:', data);
              setGridData(data.data[0]); 
            } else {
              console.error('백엔드 요청 실패:', response.status);
            }
          } catch (error) {
            console.error('백엔드와의 통신 중 에러:', error);
          }
        }

        function zoomToFeature(feature) {
          const projected = projection(feature.geometry.coordinates);
          if (!projected || projected.includes(NaN)) {
            console.error('Projection failed for coordinates:', feature.geometry.coordinates);
            return;
          }

          const [x, y] = projected;
          const scale = 6;
          const translate = [width / 2 - scale * x, height / 2 - scale * y];

          svg
            .transition()
            .duration(750)
            .call(
              zoom.transform,
              d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        }
      } catch (error) {
        console.error('GeoJSON 데이터를 로드하는 중 에러 발생:', error);
      }
    };

    fetchData();
  }, []);

  // 선택한 격자 데이터를 시각화하는 useEffect
  useEffect(() => {
    if (gridData) {
      renderSelectedChart(gridData);
    } else {
      clearSelectedChart();
    }
  }, [gridData]);

  // 컴포넌트 마운트 시 Feature Importance 차트를 렌더링
  useEffect(() => {
    renderFeatureImportanceChart();
  }, []); // 빈 배열로 한 번만 실행

  // 선택한 격자 데이터 시각화 함수
  function renderSelectedChart(data) {
    const chartElement = d3.select(selectedChartRef.current);
    chartElement.selectAll('*').remove(); 

    const ageData = [
      { ageGroup: '유아', value: data.realkid || 0 },
      { ageGroup: '초등학생', value: data.element || 0 },
      { ageGroup: '중학생', value: data.middle || 0 },
      { ageGroup: '고등학생', value: data.high || 0 },
      { ageGroup: '20대', value: data.twenty || 0 },
      { ageGroup: '30대', value: data.thirty || 0 },
      { ageGroup: '40대', value: data.fourty || 0 },
      { ageGroup: '50대', value: data.fifty || 0 },
      { ageGroup: '60대', value: data.sixty || 0 },
      { ageGroup: '70대 이상', value: data.seventy || 0 },
    ];

    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = chartElement
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .style('overflow', 'visible');

    const chartGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xScale = d3
      .scaleBand()
      .domain(ageData.map((d) => d.ageGroup))
      .range([0, width])
      .padding(0.2);

    const xAxis = d3.axisBottom(xScale);

    chartGroup
      .append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(ageData, (d) => d.value) * 1.1])
      .range([height, 0]);

    const yAxis = d3.axisLeft(yScale);

    chartGroup.append('g').call(yAxis);

    chartGroup
      .selectAll('.bar')
      .data(ageData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(d.ageGroup))
      .attr('y', (d) => yScale(d.value))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => height - yScale(d.value))
      .attr('fill', '#69b3a2');

    // Y축 레이블
    chartGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(${-60}, ${height / 2}) rotate(-90)`)
      .attr('fill', '#ffffff')
      .text('인구 수');

    // X축 레이블
    chartGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(${width / 2}, ${height + 40})`)
      .attr('fill', '#ffffff')
      .text('연령대');
  }

  // Feature Importance 차트 시각화 함수
  function renderFeatureImportanceChart() {
    const chartElement = d3.select(featureChartRef.current);
    chartElement.selectAll('*').remove(); 

    const data = featureImportanceData;

    const margin = { top: 20, right: 20, bottom: 100, left: 80 };
    const width = 500 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = chartElement
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .style('overflow', 'visible');

    const chartGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xScale = d3
      .scaleBand()
      .domain(data.map((d) => d.feature))
      .range([0, width])
      .padding(0.2);

    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => d); // 필요에 따라 포맷 조정 가능

    chartGroup
      .append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('fill', '#ffffff'); // 축 레이블 색상 변경

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.importance) * 1.1])
      .range([height, 0]);

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d3.format(".2f")); // 소수점 2자리까지 표시

    chartGroup.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('fill', '#ffffff'); // 축 레이블 색상 변경

    // 막대 추가
    chartGroup
      .selectAll('.feature-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'feature-bar')
      .attr('x', (d) => xScale(d.feature))
      .attr('y', (d) => yScale(d.importance))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => height - yScale(d.importance))
      .attr('fill', '#ff7f0e'); // Feature Importance 막대 색상 변경

    // Y축 레이블
    chartGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(${-60}, ${height / 2}) rotate(-90)`)
      .attr('fill', '#ffffff')
      .text('Feature Importance');

    // X축 레이블
    chartGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(${width / 2}, ${height + 80})`)
      .attr('fill', '#ffffff')
      .text('Feature');
  }

  // 선택한 격자 데이터 차트를 클리어하는 함수
  function clearSelectedChart() {
    const chartElement = d3.select(selectedChartRef.current);
    chartElement.selectAll('*').remove(); 
  }

  return (
    <main className="main-content">
      <h1>GeoJSON Grid Map</h1>
      <div className="map-container">
        <svg ref={svgRef}></svg>
        <div className="info-container">
          <div className="info-box">
            <h2>선택한 격자 데이터</h2>
            {gridData ? (
              <div className="bar-chart" ref={selectedChartRef}></div>
            ) : (
              <p>격자를 선택하면 데이터가 표시됩니다.</p>
            )}
          </div>
          <div className="info-box">
            <h2>Feature Importance</h2>
            <div className="feature-bar-chart" ref={featureChartRef}></div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dataset;

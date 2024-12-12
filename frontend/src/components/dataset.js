// Dataset.js
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import './dataset.css';

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
      const gridSize = 0.001; // 100m 단위

      // Leaflet 지도 생성
      const map = L.map('map', {
        center: [36.35, 127.38],
        zoom: 12,
        layers: [
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
          }),
        ],
      });

      const overlayPane = map.getPanes().overlayPane;
      overlayPane.appendChild(svgRef.current);

      const svg = d3.select(svgRef.current)
        .style('position', 'absolute')
        .style('z-index', 999)
        .style('pointer-events', 'none');

      svg.selectAll('*').remove();

      try {
        const csvData = await d3.csv(`${process.env.PUBLIC_URL}/data/ssookssook.csv`);
        const daejeonData = await d3.json(`${process.env.PUBLIC_URL}/data/daejeon.geojson`);
        const seoGuData = await d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`);

        if (!daejeonData?.features || !seoGuData?.features) {
          throw new Error('GeoJSON 데이터가 비어 있습니다.');
        }

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

        const g = svg.append('g');

        // 대전 경계 (투명한 폴리곤)
        const polygonGroup = g.append('path')
          .attr('class', 'daejeon-boundary')
          .attr('fill', 'none')
          .attr('stroke', '#999999')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none');

        // 100m 격자
        const gridCells = seoGuData.features.filter(d => d.geometry && d.geometry.coordinates);

        const cells = g.selectAll('.grid-cell')
          .data(gridCells)
          .enter()
          .append('rect')
          .attr('class', 'grid-cell')
          .style('pointer-events', 'all')
          .attr('stroke', '#000000')      
          .attr('stroke-width', 0.1)      
          .attr('fill', (d) => {
            const coords = d.geometry.coordinates;
            const aligned = alignToGrid([coords[0], coords[1]], gridSize);
            const key = aligned.join(',');
            const vals = valueMap[key] || { actual:0, predict:0 };
            return getColor(vals.actual, vals.predict);
          })
          .style('opacity', 0.5) // 투명도 적용
          .on('mouseover', function() {
            d3.select(this).attr('fill', '#ffcc00').style('opacity',1);
          })
          .on('mouseout', function(event, d) {
            const coords = d.geometry.coordinates;
            const aligned = alignToGrid([coords[0], coords[1]], gridSize);
            const key = aligned.join(',');
            const vals = valueMap[key] || {actual:0, predict:0};
            d3.select(this)
              .attr('fill', getColor(vals.actual, vals.predict))
              .style('opacity', 0.5); // 마우스 아웃 시 다시 투명도 적용
          })
          .on('click', function (event, d) {
            if (!d.geometry || !d.geometry.coordinates) return;
            const coords = d.geometry.coordinates;
            zoomToFeature(d, map);
            sendCoordinatesToBackend([coords[0], coords[1]]);
          });

        function update() {
          const bounds = map.getBounds();
          const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
          const bottomRight = map.latLngToLayerPoint(bounds.getSouthEast());

          const width = bottomRight.x - topLeft.x;
          const height = bottomRight.y - topLeft.y;

          svg
            .attr('width', width)
            .attr('height', height)
            .style('left', topLeft.x + 'px')
            .style('top', topLeft.y + 'px');

          g.attr('transform', `translate(${-topLeft.x}, ${-topLeft.y})`);

          cells
            .attr('x', (d) => {
              const coords = d.geometry.coordinates;
              const latlngTopLeft = L.latLng(coords[1], coords[0]);
              const pointTopLeft = map.latLngToLayerPoint(latlngTopLeft);
              return pointTopLeft.x;
            })
            .attr('y', (d) => {
              const coords = d.geometry.coordinates;
              const latlngTopLeft = L.latLng(coords[1], coords[0]);
              const pointTopLeft = map.latLngToLayerPoint(latlngTopLeft);
              return pointTopLeft.y;
            })
            .attr('width', (d) => {
              const coords = d.geometry.coordinates;
              const latlngTopLeft = L.latLng(coords[1], coords[0]);
              const latlngBottomRight = L.latLng(coords[1]+gridSize, coords[0]+gridSize);
              const pointTopLeft = map.latLngToLayerPoint(latlngTopLeft);
              const pointBottomRight = map.latLngToLayerPoint(latlngBottomRight);
              return pointBottomRight.x - pointTopLeft.x;
            })
            .attr('height', (d) => {
              const coords = d.geometry.coordinates;
              const latlngTopLeft = L.latLng(coords[1], coords[0]);
              const latlngBottomRight = L.latLng(coords[1]+gridSize, coords[0]+gridSize);
              const pointTopLeft = map.latLngToLayerPoint(latlngTopLeft);
              const pointBottomRight = map.latLngToLayerPoint(latlngBottomRight);
              return pointTopLeft.y - pointBottomRight.y;
            });

          const geometry = daejeonData.features[0].geometry;
          let polygonCoords;
          if (geometry.type === "MultiPolygon") {
            polygonCoords = geometry.coordinates[0][0];
          } else if (geometry.type === "Polygon") {
            polygonCoords = geometry.coordinates[0];
          } else {
            console.error("지원하지 않는 geometry type:", geometry.type);
            polygonCoords = [];
          }

          polygonCoords = polygonCoords.filter(coord =>
            Array.isArray(coord) &&
            coord.length === 2 &&
            typeof coord[0] === 'number' &&
            typeof coord[1] === 'number'
          );

          if (polygonCoords.length > 0) {
            const pathData = polygonCoords.map(coord => {
              const point = map.latLngToLayerPoint([coord[1], coord[0]]);
              return [point.x, point.y];
            });
            const d = d3.line()(pathData);
            polygonGroup.attr('d', d);
          } else {
            polygonGroup.attr('d', null);
          }
        }

        map.on('moveend zoomend', update);
        update();

        function alignToGrid(coordinates, gridSize) {
          const [lng, lat] = coordinates;
          const x = Math.floor(lng / gridSize) * gridSize;
          const y = Math.floor(lat / gridSize) * gridSize;
          return [x, y];
        }

        function getColor(actual, predict) {
          if (actual === 1 && predict === 1) return '#00FF00';
          else if (actual === 1 && predict === 0) return '#9b111e';
          else if (actual === 0 && predict === 1) return '#0000FF';
          else return '#ffffff';
        }

        async function sendCoordinatesToBackend(coords) {
          try {
            if (!coords || coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return;
            const response = await fetch('http://127.0.0.1:8000/api/get_xy/', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ longitude: coords[0], latitude: coords[1] }),
            });

            if (response.ok) {
              const data = await response.json();
              setGridData(data.data[0]);
            } else {
              console.error('백엔드 요청 실패:', response.status);
            }
          } catch (error) {
            console.error('백엔드와의 통신 중 에러:', error);
          }
        }

        function zoomToFeature(feature, map) {
          const coords = feature.geometry.coordinates;
          map.setView([coords[1], coords[0]], 15);
        }

      } catch (error) {
        console.error('GeoJSON 데이터를 로드하는 중 에러 발생:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (gridData) {
      renderSelectedChart(gridData);
    } else {
      clearSelectedChart();
    }
  }, [gridData]);

  useEffect(() => {
    renderFeatureImportanceChart();
  }, []);

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
      .tickFormat(d => d);

    chartGroup
      .append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .style('fill', '#ffffff');

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.importance) * 1.1])
      .range([height, 0]);

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d3.format(".2f"));

    chartGroup.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('fill', '#ffffff');

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
      .attr('fill', '#ff7f0e');

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

  function clearSelectedChart() {
    const chartElement = d3.select(selectedChartRef.current);
    chartElement.selectAll('*').remove();
  }

  return (
    <main className="main-content">
      <h1>GeoJSON Grid Map</h1>
      <div className="map-container" style={{ position: 'relative' }}>
        <div id="map" style={{ width: '800px', height: '600px' }}></div>
        <svg ref={svgRef} style={{ position: 'absolute', top: 0, left: 0 }}></svg>
        <div className="info-container" style={{ position: 'relative', zIndex: 999 }}>
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

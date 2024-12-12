// Dataset.js
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './dataset.css';

const Dataset = () => {
  const svgRef = useRef(null); 
  const chartRef = useRef(null); 
  const [gridData, setGridData] = useState(null); 

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

  useEffect(() => {
    if (gridData) {
      renderBarChart(gridData);
    }
  }, [gridData]);

  function renderBarChart(data) {
    const chartElement = d3.select(chartRef.current);
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

    chartGroup
      .append('text')
      .attr('text-anchor', 'end')
      .attr('x', -40)
      .attr('y', -10)
      .attr('dy', '.75em')
      .text('인구 수');

    chartGroup
      .append('text')
      .attr('text-anchor', 'end')
      .attr('x', width + 20)
      .attr('y', height + 40)
      .text('연령대');
  }

  return (
    <main className="main-content">
      <h1>GeoJSON Grid Map</h1>
      <div className="map-container">
        <svg ref={svgRef}></svg>
        <div className="info-box">
          <h2>선택한 격자 데이터</h2>
          {gridData ? (
            <div ref={chartRef}></div>
          ) : (
            <p>격자를 선택하면 데이터가 표시됩니다.</p>
          )}
        </div>
      </div>
    </main>
  );
};

export default Dataset;

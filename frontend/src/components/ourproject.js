import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import './ourproject.css';

const OurProject = () => {
  const svgRef = useRef(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    // Leaflet 지도 생성
    const leafletMap = L.map('map', {
      center: [36.35, 127.38],
      zoom: 12,
      layers: [
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }),
      ],
    });
    setMap(leafletMap);

    // SVG 오버레이 생성 후 overlayPane에 추가
    const overlayPane = leafletMap.getPanes().overlayPane;
    if (!svgRef.current) {
      svgRef.current = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    }
    overlayPane.appendChild(svgRef.current);

    // 데이터 로드 및 집계
    const fetchData = async () => {
      try {
        const csvData = await d3.csv(`${process.env.PUBLIC_URL}/data/ssookssook.csv`);
        const geoData = await d3.json(`${process.env.PUBLIC_URL}/data/dong.geojson`);

        // 각 행정동 feature에 집계 필드 초기화
        geoData.features.forEach(feature => {
          feature.properties.aggActual = 0;
          feature.properties.aggPredict = 0;
        });

        // CSV의 각 좌표가 어느 행정동에 포함되는지 확인 후 값 누적
        csvData.forEach(row => {
          const lat = parseFloat(row["위도"]);
          const lng = parseFloat(row["경도"]);
          const actualVal = parseInt(row["실제값"], 10) || 0;
          const predictVal = parseInt(row["예측값"], 10) || 0;
          const point = [lng, lat];

          geoData.features.forEach(feature => {
            if (d3.geoContains(feature, point)) {
              feature.properties.aggActual += actualVal;
              feature.properties.aggPredict += predictVal;
            }
          });
        });

        // D3 projection 생성: Leaflet 좌표를 SVG 좌표로 변환
        function projectPoint(x, y) {
          const point = leafletMap.latLngToLayerPoint(new L.LatLng(y, x));
          this.stream.point(point.x, point.y);
        }
        const projection = d3.geoTransform({ point: projectPoint });
        const path = d3.geoPath().projection(projection);

        // SVG 요소 선택 및 group 추가
        const svg = d3.select(svgRef.current)
          .style('position', 'absolute')
          .style('pointer-events', 'none');
        const g = svg.append('g').attr('class', 'leaflet-zoom-hide');

        // 행정동 경계를 그리고, 색상은 getColor 함수로 결정 (여기서는 모두 밝은 회색)
        const features = g.selectAll('path')
          .data(geoData.features)
          .enter()
          .append('path')
          .attr('class', 'adm-dong')
          .attr('fill', d => getColor(d.properties.aggActual, d.properties.aggPredict))
          .attr('stroke', '#000')
          .attr('stroke-width', 1)
          .style('opacity', 0.7)
          .style('pointer-events', 'all')
          .on('mouseover', function(event, d) {
            d3.select(this)
              .attr('fill', 'rgba(211,211,211,0.5)')
              .style('opacity', 1);
          })
          .on('mouseout', function(event, d) {
            d3.select(this)
              .attr('fill', getColor(d.properties.aggActual, d.properties.aggPredict))
              .style('opacity', 0.7);
          })
          .on('click', function(event, d) {
            // 다각형 중심 좌표 계산 후 지도 확대 및 백엔드 호출
            const centroid = d3.geoCentroid(d);
            leafletMap.setView([centroid[1], centroid[0]], 15);
            sendCoordinatesToBackend(centroid);
          });

        // 지도 이동 및 확대/축소에 따라 SVG 오버레이 업데이트
        function update() {
          const bounds = leafletMap.getBounds();
          const topLeft = leafletMap.latLngToLayerPoint(bounds.getNorthWest());
          const bottomRight = leafletMap.latLngToLayerPoint(bounds.getSouthEast());

          svg
            .attr('width', bottomRight.x - topLeft.x)
            .attr('height', bottomRight.y - topLeft.y)
            .style('left', topLeft.x + 'px')
            .style('top', topLeft.y + 'px');

          g.attr('transform', `translate(${-topLeft.x}, ${-topLeft.y})`);
          features.attr('d', path);
        }
        leafletMap.on('moveend zoomend', update);
        update();
      } catch (error) {
        console.error('데이터 로드 오류:', error);
      }
    };

    fetchData();

    // 컴포넌트 언마운트 시 지도 정리
    return () => {
      leafletMap.off('moveend zoomend');
      leafletMap.remove();
    };
  }, []);

  // 모든 조건에 대해 밝은 회색 (light gray)과 50% 투명도를 반환하는 getColor 함수
  const getColor = (actual, predict) => {
    return 'rgba(177, 180, 226, 0.9)';
  };

  // 백엔드에 선택된 좌표를 전송하는 함수
  const sendCoordinatesToBackend = async (coords) => {
    try {
      if (!coords || coords.length !== 2) return;
      const response = await fetch('http://127.0.0.1:8000/api/get_xy/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ longitude: coords[0], latitude: coords[1] }),
      });
      if (response.ok) {
        const data = await response.json();
        console.log('백엔드 데이터:', data);
      } else {
        console.error('백엔드 요청 실패:', response.status);
      }
    } catch (error) {
      console.error('좌표 전송 중 오류:', error);
    }
  };

  return (
    <div className="main-container">
      <h1>행정동별 해충 민원 시각화</h1>
      <div id="map" style={{ width: '800px', height: '600px' }}></div>
    </div>
  );
};

export default OurProject;

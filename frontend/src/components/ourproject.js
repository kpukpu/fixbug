// src/components/OurProject.js
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import * as d3 from 'd3';
import 'leaflet/dist/leaflet.css';
import './ourproject.css';

export default function OurProject() {
  const svgRef = useRef(null);
  const [leafletMap, setLeafletMap] = useState(null);

  const GRID = 0.001;
  const Z_DONG = 12;
  const Z_GRID = 15;

  useEffect(() => {
    /* ---------------- Leaflet ------------------ */
    const map = L.map('map', {
      center: [36.35, 127.38],
      zoom: Z_DONG,
      layers: [
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }),
      ],
    });
    setLeafletMap(map);

    /* ---------------- SVG overlay -------------- */
    if (!svgRef.current)
      svgRef.current = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    map.getPanes().overlayPane.appendChild(svgRef.current);
    const svg = d3
      .select(svgRef.current)
      .style('position', 'absolute')
      .style('pointer-events', 'none');

    /* -------------- DATA LOAD ------------------ */
    Promise.all([
      d3.json(`${process.env.PUBLIC_URL}/data/dong.geojson`),
      d3.json(`${process.env.PUBLIC_URL}/data/map.geojson`),
      d3.csv(`${process.env.PUBLIC_URL}/data/ssookssook.csv`),
    ]).then(([dongGeo, gridGeo, csv]) => {
      /* ==== util functions (선행 선언) ==== */
      const snap = ([lng, lat]) => [
        Math.floor(lng / GRID) * GRID,
        Math.floor(lat / GRID) * GRID,
      ];
      const origin = (f) => {
        if (!f?.geometry) return [null, null];
        const { type, coordinates: C } = f.geometry;
        if (type === 'Point') return C;
        if (type === 'Polygon') return C[0][0];
        if (type === 'MultiPolygon') return C[0][0][0];
        return [null, null];
      };
      const rev = ([lng, lat]) => [lat, lng];
      const color = (a, p) => {
        if (a === 1 && p === 1) return '#00FF00';
        if (a === 1 && p === 0) return '#9b111e';
        if (a === 0 && p === 1) return '#0000FF';
        return '#ffffff';
      };

      /* ==== CSV → valueMap ==== */
      const val = {};
      csv.forEach((r) => {
        const key = snap([+r.경도, +r.위도]).join(',');
        val[key] = { a: +r.실제값 || 0, p: +r.예측값 || 0 };
      });

      /* SVG groups */
      const g = svg.append('g');
      const layerDong = g.append('g');
      const layerGrid = g.append('g').style('display', 'none');

      /* projection path */
      const path = d3.geoPath().projection(
        d3.geoTransform({
          point(x, y) {
            const p = map.latLngToLayerPoint([y, x]);
            // @ts-ignore
            this.stream.point(p.x, p.y);
          },
        })
      );

      /* ========== 행정동 렌더 & 클릭 ========== */
      layerDong
        .selectAll('path')
        .data(dongGeo.features)
        .enter()
        .append('path')
        .attr('fill', '#b1b4e2')
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .style('pointer-events', 'all')
        .on('mouseover', function () { d3.select(this).attr('fill', '#d3d3d3'); })
        .on('mouseout',  function () { d3.select(this).attr('fill', '#b1b4e2'); })
        .on('click', function (event, dongF) {
          /* 지도 확대 */
          const [lng, lat] = d3.geoCentroid(dongF);
          map.setView([lat, lng], Z_GRID);

          /* 선택 행정동 숨김 */
          d3.select(this).style('display', 'none');

          /* 해당 행정동의 100 m 격자만 표시 */
          layerGrid.selectAll('*').remove();
          layerGrid.style('display', 'block');

          const inside = gridGeo.features.filter((f) =>
            d3.geoContains(dongF, d3.geoCentroid(f))
          );

          layerGrid
            .selectAll('rect')
            .data(inside)
            .enter()
            .append('rect')
            .attr('stroke', '#000')
            .attr('stroke-width', 0.1)
            .style('pointer-events', 'all')
            .attr('fill', (f) => {
              const k = snap(origin(f)).join(',');
              const v = val[k] || { a: 0, p: 0 };
              return color(v.a, v.p);
            })
            .style('opacity', 0.7)
            .on('mouseover', function () {
              d3.select(this).attr('fill', '#ffcc00').style('opacity', 1);
            })
            .on('mouseout', function (e, f) {
              const k = snap(origin(f)).join(',');
              const v = val[k] || { a: 0, p: 0 };
              d3.select(this).attr('fill', color(v.a, v.p)).style('opacity', 0.7);
            });

          update();
        });

      /* ========== 공통 update ========== */
      function update() {
        const b = map.getBounds();
        const tl = map.latLngToLayerPoint(b.getNorthWest());
        const br = map.latLngToLayerPoint(b.getSouthEast());

        svg
          .attr('width', br.x - tl.x)
          .attr('height', br.y - tl.y)
          .style('left', `${tl.x}px`)
          .style('top', `${tl.y}px`);

        g.attr('transform', `translate(${-tl.x}, ${-tl.y})`);
        layerDong.selectAll('path').attr('d', path);

        layerGrid.selectAll('rect')
          .attr('x', (f) => map.latLngToLayerPoint(rev(origin(f))).x)
          .attr('y', (f) => map.latLngToLayerPoint(rev(origin(f))).y)
          .attr('width', (f) => {
            const [lng, lat] = origin(f);
            const p1 = map.latLngToLayerPoint([lat, lng]);
            const p2 = map.latLngToLayerPoint([lat + GRID, lng + GRID]);
            return p2.x - p1.x;
          })
          .attr('height', (f) => {
            const [lng, lat] = origin(f);
            const p1 = map.latLngToLayerPoint([lat, lng]);
            const p2 = map.latLngToLayerPoint([lat + GRID, lng + GRID]);
            return p1.y - p2.y;
          });
      }

      map.on('moveend zoomend', update);
      update();
    });

    return () => map.remove();
  }, []);

  return (
    <div className="main-container">
      <h1>행정동 → 100 m 격자 시각화</h1>
      <div id="map" style={{ width: '800px', height: '600px' }}></div>
    </div>
  );
}

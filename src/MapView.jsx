// src/MapView.jsx

import React, { useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// Import Leaflet images
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet's default icon paths
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom icons for start and end markers (small red dots)
const startIcon = new L.Icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg',
  iconSize: [15, 15],
  iconAnchor: [7.5, 7.5],
  popupAnchor: [0, -5],
});

const endIcon = new L.Icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg',
  iconSize: [15, 15],
  iconAnchor: [7.5, 7.5],
  popupAnchor: [0, -5],
});

const initialShipments = [];

const MapView = () => {
  const [shipments, setShipments] = useState(initialShipments);
  const [formData, setFormData] = useState({
    id: '',
    startLocation: { name: '', lat: '', lng: '' },
    endLocation: { name: '', lat: '', lng: '' },
    serviceType: 'One-way OBC',
    personnel: 'L C',
  });
  const [editingShipment, setEditingShipment] = useState(null);

  const mapRef = useRef(null);

  // Handle form changes, including nested objects
  const handleFormChange = (e) => {
    const { name, value } = e.target;

    // Handle nested fields
    setFormData((prevFormData) => {
      const updatedFormData = { ...prevFormData };

      if (name.includes('.')) {
        const [parent, child] = name.split('.');
        updatedFormData[parent] = {
          ...updatedFormData[parent],
          [child]: value,
        };
      } else {
        updatedFormData[name] = value;
      }

      return updatedFormData;
    });
  };

  // Function to geocode addresses
  const geocodeAddress = async (address) => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: address,
          format: 'json',
        },
      });

      if (response.data && response.data.length > 0) {
        const { lat, lon } = response.data[0];
        return { lat: parseFloat(lat), lng: parseFloat(lon) };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Geocode the start and end locations
    const startCoords = await geocodeAddress(formData.startLocation.name);
    const endCoords = await geocodeAddress(formData.endLocation.name);

    if (!startCoords || !endCoords) {
      alert('Unable to geocode the provided locations.');
      return;
    }

    const newShipment = {
      ...formData,
      startLocation: {
        ...formData.startLocation,
        lat: startCoords.lat,
        lng: startCoords.lng,
      },
      endLocation: {
        ...formData.endLocation,
        lat: endCoords.lat,
        lng: endCoords.lng,
      },
    };

    if (editingShipment) {
      const updatedShipments = shipments.map((shipment) =>
        shipment.id === editingShipment.id ? newShipment : shipment
      );
      setShipments(updatedShipments);
      setEditingShipment(null);
    } else {
      setShipments([...shipments, newShipment]);
    }

    // Reset form
    setFormData({
      id: '',
      startLocation: { name: '', lat: '', lng: '' },
      endLocation: { name: '', lat: '', lng: '' },
      serviceType: 'One-way OBC',
      personnel: 'L C',
    });
  };

  // Handle deleting a shipment
  const handleDelete = (id) => {
    const updatedShipments = shipments.filter((shipment) => shipment.id !== id);
    setShipments(updatedShipments);
  };

  // Handle editing a shipment
  const handleEdit = (id) => {
    const shipmentToEdit = shipments.find((shipment) => shipment.id === id);
    setFormData(shipmentToEdit);
    setEditingShipment(shipmentToEdit);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', margin: 0 }}>
      {/* Side Panel for Adding or Editing Shipments */}
      <div style={{ flex: '0 0 25%', padding: '20px', boxSizing: 'border-box' }}>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            textAlign: 'left',
          }}
        >
          <h3>{editingShipment ? 'Edit Shipment' : 'Add Shipment'}</h3>
          <label>
            Shipment ID:
            <input
              type="text"
              name="id"
              value={formData.id}
              onChange={handleFormChange}
              required
            />
          </label>

          <label>
            Start Location Name:
            <input
              type="text"
              name="startLocation.name"
              value={formData.startLocation.name}
              onChange={handleFormChange}
              placeholder="Enter start location"
              required
            />
          </label>

          <label>
            End Location Name:
            <input
              type="text"
              name="endLocation.name"
              value={formData.endLocation.name}
              onChange={handleFormChange}
              placeholder="Enter end location"
              required
            />
          </label>

          <label>
            Service Type:
            <select
              name="serviceType"
              value={formData.serviceType}
              onChange={handleFormChange}
            >
              <option value="One-way OBC">One-way OBC</option>
              <option value="Airfreight">Airfreight</option>
              <option value="Trainfreight">Trainfreight</option>
              <option value="Direct drive">Direct drive</option>
            </select>
          </label>

          <label>
            Personnel:
            <select
              name="personnel"
              value={formData.personnel}
              onChange={handleFormChange}
            >
              <option value="L C">L C</option>
              <option value="S M">S M</option>
              <option value="S D">S D</option>
            </select>
          </label>

          <button type="submit">
            {editingShipment ? 'Update Shipment' : 'Add Shipment'}
          </button>
        </form>

        <h3>Shipments</h3>
        <ul>
          {shipments.map((shipment) => (
            <li key={shipment.id}>
              {shipment.id}{' '}
              <button onClick={() => handleEdit(shipment.id)}>Edit</button>{' '}
              <button onClick={() => handleDelete(shipment.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>

      {/* Map Display */}
      <div style={{ flex: '1', height: '100%' }}>
        <MapContainer
          center={[51.505, -0.09]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {shipments.map((shipment) => (
            <React.Fragment key={shipment.id}>
              <Marker
                position={[
                  shipment.startLocation.lat,
                  shipment.startLocation.lng,
                ]}
                icon={startIcon}
              >
                <Popup>
                  <strong>Shipment ID:</strong> {shipment.id}
                  <br />
                  <strong>Service Type:</strong> {shipment.serviceType}
                  <br />
                  <strong>Personnel:</strong> {shipment.personnel}
                  <br />
                  <strong>Start:</strong> {shipment.startLocation.name}
                  <br />
                  <strong>End:</strong> {shipment.endLocation.name}
                </Popup>
              </Marker>

              <Marker
                position={[
                  shipment.endLocation.lat,
                  shipment.endLocation.lng,
                ]}
                icon={endIcon}
              >
                <Popup>
                  <strong>Shipment ID:</strong> {shipment.id}
                  <br />
                  <strong>Service Type:</strong> {shipment.serviceType}
                  <br />
                  <strong>Personnel:</strong> {shipment.personnel}
                  <br />
                  <strong>Start:</strong> {shipment.startLocation.name}
                  <br />
                  <strong>End:</strong> {shipment.endLocation.name}
                </Popup>
              </Marker>

              <Polyline
                positions={[
                  [shipment.startLocation.lat, shipment.startLocation.lng],
                  [shipment.endLocation.lat, shipment.endLocation.lng],
                ]}
                color="blue"
              />
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapView;

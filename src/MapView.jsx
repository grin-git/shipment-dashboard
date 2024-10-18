// src/MapView.jsx

import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// Import Firebase functions
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';

// Import Leaflet images
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet's default icon paths
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom icon for markers (small red dot)
const customIcon = new L.Icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg',
  iconSize: [15, 15],
  iconAnchor: [7.5, 7.5],
  popupAnchor: [0, -5],
});

const MapView = () => {
  const [shipments, setShipments] = useState([]);

  const [formData, setFormData] = useState({
    id: '',
    startLocation: { name: '', lat: '', lng: '' },
    endLocation: { name: '', lat: '', lng: '' },
    serviceType: 'One-way OBC',
    personnel: 'L C',
  });
  const [editingShipment, setEditingShipment] = useState(null);

  const [showShipments, setShowShipments] = useState(true); // For collapsing the shipments list

  // State variables for filters
  const [filterServiceType, setFilterServiceType] = useState('');
  const [filterPersonnel, setFilterPersonnel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const mapRef = useRef(null);

  // Fetch shipments from Firebase
  useEffect(() => {
    const shipmentsCollection = collection(db, 'shipments');
    const unsubscribe = onSnapshot(shipmentsCollection, (snapshot) => {
      const shipmentsData = snapshot.docs.map((doc) => doc.data());
      setShipments(shipmentsData);
    });

    return () => unsubscribe();
  }, []);

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

    try {
      const shipmentDoc = doc(db, 'shipments', newShipment.id);
      await setDoc(shipmentDoc, newShipment);
      setEditingShipment(null);

      // Reset form
      setFormData({
        id: '',
        startLocation: { name: '', lat: '', lng: '' },
        endLocation: { name: '', lat: '', lng: '' },
        serviceType: 'One-way OBC',
        personnel: 'L C',
      });
    } catch (error) {
      console.error('Error adding or updating shipment:', error);
    }
  };

  // Handle deleting a shipment
  const handleDelete = async (id) => {
    try {
      const shipmentDoc = doc(db, 'shipments', id);
      await deleteDoc(shipmentDoc);
    } catch (error) {
      console.error('Error deleting shipment:', error);
    }
  };

  // Handle editing a shipment
  const handleEdit = async (id) => {
    try {
      const shipmentDoc = doc(db, 'shipments', id);
      const docSnap = await getDoc(shipmentDoc);
      if (docSnap.exists()) {
        setFormData(docSnap.data());
        setEditingShipment(docSnap.data());
      } else {
        console.log('No such document!');
      }
    } catch (error) {
      console.error('Error fetching shipment for edit:', error);
    }
  };

  // Filter shipments based on filters and search term
  const filteredShipments = shipments.filter((shipment) => {
    const matchesServiceType = filterServiceType
      ? shipment.serviceType === filterServiceType
      : true;
    const matchesPersonnel = filterPersonnel
      ? shipment.personnel === filterPersonnel
      : true;
    const matchesSearchTerm = shipment.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesServiceType && matchesPersonnel && matchesSearchTerm;
  });

  return (
    <div className="container">
      {/* Side Panel for Adding or Editing Shipments */}
      <div className="side-panel">
        <form onSubmit={handleSubmit} className="form">
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

        {/* Collapsible Shipments List */}
        <h3
          className="collapsible-header"
          onClick={() => setShowShipments(!showShipments)}
          style={{ cursor: 'pointer' }}
        >
          Shipments {showShipments ? '▲' : '▼'}
        </h3>

        {showShipments && (
          <>
            {/* Filters */}
            <div className="filter-section">
              <h4>Filters</h4>
              <label>
                Service Type:
                <select
                  value={filterServiceType}
                  onChange={(e) => setFilterServiceType(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="One-way OBC">One-way OBC</option>
                  <option value="Airfreight">Airfreight</option>
                  <option value="Trainfreight">Trainfreight</option>
                  <option value="Direct drive">Direct drive</option>
                </select>
              </label>

              <label>
                Personnel:
                <select
                  value={filterPersonnel}
                  onChange={(e) => setFilterPersonnel(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="L C">L C</option>
                  <option value="S M">S M</option>
                  <option value="S D">S D</option>
                </select>
              </label>

              <label>
                Search Shipments:
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter shipment ID"
                />
              </label>
            </div>

            {/* Shipments List */}
            <ul className="shipments-list">
              {filteredShipments.map((shipment) => (
                <li key={shipment.id}>
                  {shipment.id}{' '}
                  <button onClick={() => handleEdit(shipment.id)}>Edit</button>{' '}
                  <button onClick={() => handleDelete(shipment.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Map Display */}
      <div className="map-container">
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

          {filteredShipments.map((shipment) => (
            <React.Fragment key={shipment.id}>
              {/* Start Marker */}
              <Marker
                position={[shipment.startLocation.lat, shipment.startLocation.lng]}
                icon={customIcon}
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

              {/* End Marker */}
              <Marker
                position={[shipment.endLocation.lat, shipment.endLocation.lng]}
                icon={customIcon}
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

              {/* Polyline */}
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

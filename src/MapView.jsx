// src/MapView.jsx

import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './MapView.css';
import 'leaflet-polylinedecorator'; // Import the leaflet-polylinedecorator plugin
import axios from 'axios';
import { db, auth } from './firebase';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

// Fix Leaflet's default icon paths using CDN
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for markers (small red dot)
const customIcon = new L.Icon({
  iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg',
  iconSize: [15, 15],
  iconAnchor: [7.5, 7.5],
  popupAnchor: [0, -5],
});

// Custom component to handle Polylines with Arrowheads in the middle
const PolylineWithArrow = ({ positions, color }) => {
  const polylineRef = useRef(null);
  const map = useMap();

  useEffect(() => {
    const polyline = polylineRef.current;
    if (polyline) {
      // Remove existing decorator if any
      if (polyline.decorator) {
        map.removeLayer(polyline.decorator);
      }

      // Create a decorator with an arrow at the middle
      const decorator = L.polylineDecorator(polyline, {
        patterns: [
          {
            offset: '50%', // Position the arrow at the middle
            repeat: 0,     // Do not repeat
            symbol: L.Symbol.arrowHead({
              pixelSize: 10,
              polygon: false,
              pathOptions: { color: color, weight: 1 },
            }),
          },
        ],
      });

      // Add the decorator to the map
      decorator.addTo(map);

      // Save the decorator instance to the polyline for future cleanup
      polyline.decorator = decorator;

      // Cleanup function to remove the decorator when the component unmounts or updates
      return () => {
        if (decorator) {
          map.removeLayer(decorator);
        }
      };
    }
  }, [positions, color, map]);

  return (
    <Polyline
      positions={positions}
      color={color}
      ref={polylineRef}
    />
  );
};

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
  const [showForm, setShowForm] = useState(true); // For hiding/unhiding the form

  // State variables for filters
  const [filterServiceType, setFilterServiceType] = useState('');
  const [filterPersonnel, setFilterPersonnel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const mapRef = useRef(null);

  const [loading, setLoading] = useState(true); // Loading state for authentication
  const [error, setError] = useState(null); // Error state for authentication

  // Handle user authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        setLoading(false);
      } else {
        // No user is signed in, sign in anonymously
        signInAnonymously(auth)
          .then(() => {
            setLoading(false);
          })
          .catch((error) => {
            console.error('Anonymous sign-in failed:', error);
            setError(error);
            setLoading(false);
          });
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch shipments from Firebase after authentication
  useEffect(() => {
    if (loading || error) return; // Do not attempt to fetch if loading or there's an error

    const shipmentsCollection = collection(db, 'shipments');
    const unsubscribe = onSnapshot(
      shipmentsCollection,
      (snapshot) => {
        const shipmentsData = snapshot.docs.map((doc) => doc.data());
        setShipments(shipmentsData);
      },
      (error) => {
        console.error('Error fetching shipments:', error);
        setError(error);
      }
    );

    return () => unsubscribe();
  }, [loading, error, db]);

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
        console.error('No geocoding results for address:', address);
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
      const shipmentDoc = doc(db, 'shipments', newShipment.id.trim());
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

  // Calculate Counts
  const totalShipments = shipments.length;

  // Counts per Shipment Type
  const shipmentTypes = {};
  shipments.forEach((shipment) => {
    const type = shipment.serviceType;
    if (shipmentTypes[type]) {
      shipmentTypes[type] += 1;
    } else {
      shipmentTypes[type] = 1;
    }
  });

  // Counts per Personnel
  const personnelCounts = {};
  shipments.forEach((shipment) => {
    const personnel = shipment.personnel;
    if (personnelCounts[personnel]) {
      personnelCounts[personnel] += 1;
    } else {
      personnelCounts[personnel] = 1;
    }
  });

  // Helper function to generate a curved line
  const generateCurve = (start, end) => {
    // Calculate midpoint for the curve
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;

    // Offset to create curve effect
    const offsetX = (end.lng - start.lng) * 0.2; // Adjust this value for more or less curvature
    const offsetY = (end.lat - start.lat) * 0.2; // Adjust this value for more or less curvature

    const curvedMidLat = midLat + offsetY;
    const curvedMidLng = midLng + offsetX;

    // Return curved polyline points
    return [
      [start.lat, start.lng],
      [curvedMidLat, curvedMidLng], // mid-point to create the curve
      [end.lat, end.lng],
    ];
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">Error: {error.message}</div>;
  }

  return (
    <div className="container">
      {/* Side Panel for Adding or Editing Shipments */}
      <div className={`side-panel ${!showForm ? 'hidden' : ''}`}>
        {/* Toggle Form Button */}
        <button
          className="toggle-form-button"
          onClick={() => setShowForm(!showForm)}
          title={showForm ? 'Hide Form' : 'Show Form'}
        >
          {showForm ? '←' : '→'}
        </button>

        {/* Form for Adding or Editing Shipments */}
        <form onSubmit={handleSubmit} className={`form ${!showForm ? 'hidden' : ''}`}>
          <h3>{editingShipment ? 'Edit Shipment' : 'Add Shipment'}</h3>
          
          <div className="form-group">
            <label>
              Shipment ID:
              <input
                type="text"
                name="id"
                value={formData.id}
                onChange={handleFormChange}
                required
                placeholder="Enter unique ID"
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Start Location:
              <input
                type="text"
                name="startLocation.name"
                value={formData.startLocation.name}
                onChange={handleFormChange}
                placeholder="Enter start location"
                required
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              End Location:
              <input
                type="text"
                name="endLocation.name"
                value={formData.endLocation.name}
                onChange={handleFormChange}
                placeholder="Enter end location"
                required
              />
            </label>
          </div>

          <div className="form-group">
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
          </div>

          <div className="form-group">
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
          </div>

          <button type="submit">
            {editingShipment ? 'Update Shipment' : 'Add Shipment'}
          </button>
        </form>

        {/* Collapsible Shipments List with Counts */}
        <div className="shipments-section">
          <h3
            className="collapsible-header"
            onClick={() => setShowShipments(!showShipments)}
          >
            Shipments {showShipments ? '▲' : '▼'}
          </h3>

          {showShipments && (
            <>
              {/* Combined Counts and Filters */}
              <div className="counts-section">
                <h4>Filters</h4>

                <div className="filter-group">
                  <label>
                    Service Type:
                    <select
                      value={filterServiceType}
                      onChange={(e) => setFilterServiceType(e.target.value)}
                    >
                      <option value="">All ({totalShipments})</option>
                      {Object.keys(shipmentTypes).map((type) => (
                        <option key={type} value={type}>
                          {type} ({shipmentTypes[type]})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="filter-group">
                  <label>
                    Personnel:
                    <select
                      value={filterPersonnel}
                      onChange={(e) => setFilterPersonnel(e.target.value)}
                    >
                      <option value="">All ({totalShipments})</option>
                      {Object.keys(personnelCounts).map((personnel) => (
                        <option key={personnel} value={personnel}>
                          {personnel} ({personnelCounts[personnel]})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="filter-group">
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
              </div>

              {/* Shipments List */}
              <ul className="shipments-list">
                {filteredShipments.map((shipment) => (
                  <li key={shipment.id} className="shipment-item">
                    <span className="shipment-id">{shipment.id}</span>
                    <div className="shipment-buttons">
                      <button onClick={() => handleEdit(shipment.id)} className="edit-button">Edit</button>
                      <button onClick={() => handleDelete(shipment.id)} className="delete-button">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
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

          {filteredShipments.map((shipment) => {
            const startCoords = {
              lat: shipment.startLocation.lat,
              lng: shipment.startLocation.lng,
            };
            const endCoords = {
              lat: shipment.endLocation.lat,
              lng: shipment.endLocation.lng,
            };

            const curvePoints = generateCurve(startCoords, endCoords); // Generate the curved line

            return (
              <React.Fragment key={shipment.id}>
                {/* Start Marker */}
                <Marker position={startCoords} icon={customIcon}>
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
                <Marker position={endCoords} icon={customIcon}>
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

                {/* Curved Polyline with Arrow in the Middle */}
                <PolylineWithArrow
                  positions={curvePoints}
                  color="blue"
                />
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapView;

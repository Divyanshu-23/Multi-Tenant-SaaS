// src/models/Property.js - Property listing schema
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false,
  },
  title: {
    type: String,
    required: [true, 'Property title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Property description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
  },
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String },
    country: { type: String, default: 'India' },
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  propertyType: {
    type: String,
    enum: ['apartment', 'house', 'villa', 'plot', 'commercial', 'office', 'shop', 'warehouse', 'other'],
    required: [true, 'Property type is required'],
  },
  features: {
    bedrooms: Number,
    bathrooms: Number,
    balconies: Number,
    kitchens: { type: Number, default: 1 },
    floors: Number,
    totalFloors: Number,
    parkingSlots: { type: Number, default: 0 },
    furnishingStatus: {
      type: String,
      enum: ['unfurnished', 'semi-furnished', 'fully-furnished'],
      default: 'unfurnished',
    },
  },
  area: {
    superArea: { type: Number, required: true },
    unit: { type: String, enum: ['sqft', 'sqm', 'sqyards'], default: 'sqft' },
  },
  amenities: [{
    type: String,
    enum: [
      'parking', 'lift', 'security', 'power_backup', 'water_supply',
      'gas_pipeline', 'garden', 'swimming_pool', 'gym', 'clubhouse',
      'children_play_area', 'indoor_games', 'shopping_complex',
      'hospital_nearby', 'school_nearby', 'railway_station_nearby',
      'airport_nearby', 'market_nearby', 'fire_safety', 'rainwater_harvesting',
      'solar_panels', 'waste_management', 'intercom', 'wifi', 'ac'
    ],
  }],
  images: [{
    url: { type: String, required: true },
    caption: { type: String },
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  }],
  documents: [{
    name: String,
    url: String,
    type: { type: String, enum: ['title_deed', 'tax_receipt', 'completion_certificate', 'other'] },
  }],
  owner: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    relation: { type: String, enum: ['owner', 'agent', 'builder', 'other'] },
  },
  status: {
    type: String,
    enum: ['available', 'sold', 'rented', 'under_negotiation', 'off_market'],
    default: 'available',
  },
  listingType: {
    type: String,
    enum: ['sale', 'rent', 'lease'],
    required: [true, 'Listing type is required'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  brokerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  views: {
    type: Number,
    default: 0,
  },
  leads: {
    type: Number,
    default: 0,
  },
  publishedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
propertySchema.index({ organizationId: 1, status: 1 });
propertySchema.index({ 'location.city': 1, 'location.state': 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ listingType: 1 });
propertySchema.index({ createdAt: -1 });
propertySchema.index({ brokerIds: 1, status: 1 });
propertySchema.index({ title: 'text', description: 'text' }); // Full-text search

// Pre-save hook
propertySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Property', propertySchema);

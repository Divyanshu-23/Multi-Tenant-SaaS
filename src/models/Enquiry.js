const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['new', 'contacted', 'visit_scheduled', 'closed'], default: 'new' },
}, { timestamps: true });

enquirySchema.index({ userId: 1, createdAt: -1 });
enquirySchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('Enquiry', enquirySchema);

// controllers/locationController.js — Quản lý văn phòng / địa điểm check-in
const OfficeLocation = require('../models/OfficeLocation');

// GET /api/locations
const getLocations = async (req, res) => {
  try {
    const locations = await OfficeLocation.find().sort({ created_at: -1 });
    res.json(locations);
  } catch (error) {
    console.error('GetLocations error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách vị trí.' });
  }
};

// POST /api/locations (Admin)
const createLocation = async (req, res) => {
  const { name, address, lat, lng, radius_m } = req.body;

  if (!name || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Tên, kinh độ và vĩ độ là bắt buộc.' });
  }

  try {
    const loc = await OfficeLocation.create({
      name: name.trim(),
      address: address?.trim() || null,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius_m: radius_m ? parseInt(radius_m) : 100,
    });

    res.status(201).json({ message: 'Đã thêm vị trí văn phòng thành công!', location: loc });
  } catch (error) {
    console.error('CreateLocation error:', error);
    res.status(500).json({ error: 'Lỗi thêm vị trí.' });
  }
};

// PUT /api/locations/:id (Admin)
const updateLocation = async (req, res) => {
  const { name, address, lat, lng, radius_m, is_active } = req.body;

  try {
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (lat !== undefined) updateData.lat = parseFloat(lat);
    if (lng !== undefined) updateData.lng = parseFloat(lng);
    if (radius_m !== undefined) updateData.radius_m = parseInt(radius_m);
    if (is_active !== undefined) updateData.is_active = is_active;

    const loc = await OfficeLocation.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!loc) return res.status(404).json({ error: 'Không tìm thấy vị trí.' });

    res.json({ message: 'Đã cập nhật vị trí!', location: loc });
  } catch (error) {
    console.error('UpdateLocation error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật vị trí.' });
  }
};

// DELETE /api/locations/:id (Admin)
const deleteLocation = async (req, res) => {
  try {
    const loc = await OfficeLocation.findByIdAndDelete(req.params.id);
    if (!loc) return res.status(404).json({ error: 'Không tìm thấy vị trí.' });

    res.json({ message: 'Đã xóa vị trí văn phòng.' });
  } catch (error) {
    console.error('DeleteLocation error:', error);
    res.status(500).json({ error: 'Lỗi xóa vị trí.' });
  }
};

module.exports = { getLocations, createLocation, updateLocation, deleteLocation };

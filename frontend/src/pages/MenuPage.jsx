import React, { useState, useEffect, useCallback } from "react";
import { useMenu } from "../context/MenuContext";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  X,
  Save,
  Package,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  PackagePlus,
} from "lucide-react";
import Navbar from "../components/navbar";
import axios from "axios";
import { showSuccess, showError, showWarning } from "../utils/toast";

const MenuPage = () => {
  const {
    menuItems,
    loading,
    fetchMenu,
    addItem,
    updateItem,
    deleteItem,
  } = useMenu();
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categories, setCategories] = useState([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItem, setStockItem] = useState(null);
  const [newStockQty, setNewStockQty] = useState(0);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: 1,
  });

  // Wrapped fetchCategories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get("/api/menu/categories");
      setCategories(res.data);
      if (res.data.length > 0) {
        setForm((prev) => ({
          ...prev,
          categoryId: prev.categoryId || res.data[0].id,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        categoryId: parseInt(form.categoryId),
      };

      if (editMode) {
        await updateItem(editingId, itemData);
        showSuccess("Item updated successfully!");
      } else {
        await addItem(itemData);
        showSuccess("Item added successfully!");
      }

      cancelForm();
    } catch (err) {
      showError("Failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      categoryId: item.categoryId,
    });
    setEditingId(item.id);
    setEditMode(true);
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      await deleteItem(id);
      showSuccess("Item deleted successfully!");
    } catch (err) {
      showError("Delete failed: " + (err.response?.data?.error || err.message));
    }
  };

  const handleToggleActive = async (item) => {
    try {
      await updateItem(item.id, { isActive: !item.isActive });
    } catch (err) {
      showError("Failed to update item status");
    }
  };

  const openStockModal = (item) => {
    setStockItem(item);
    setNewStockQty(item.inventory?.quantity || 0);
    setShowStockModal(true);
  };

  const updateStock = async () => {
    if (!stockItem?.inventory?.id) {
      showWarning("No inventory record found for this item");
      return;
    }

    try {
      await axios.put(`/api/inventory/${stockItem.inventory.id}`, {
        quantity: parseInt(newStockQty),
      });
      showSuccess("Stock updated successfully!");
      setShowStockModal(false);
      setStockItem(null);
      fetchMenu(); // Refresh menu to get updated stock
    } catch (err) {
      showError(
        "Failed to update stock: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const cancelForm = () => {
    setForm({
      name: "",
      description: "",
      price: "",
      categoryId: categories[0]?.id || 1,
    });
    setShowForm(false);
    setEditMode(false);
    setEditingId(null);
  };

  // Filter logic
  const allCategories = ["All", ...categories.map((c) => c.name)];
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Separate active and inactive items
  const activeItems = filteredItems.filter((item) => item.isActive !== false);
  const inactiveItems = filteredItems.filter((item) => item.isActive === false);

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center p-16">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Menu Management
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {activeItems.length} active items • {inactiveItems.length}{" "}
                inactive • {categories.length} categories
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchMenu}
                className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all ${
                  showForm
                    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    : "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                }`}
              >
                {showForm ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                <span>{showForm ? "Cancel" : "Add Item"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <Package className="w-6 h-6 mr-2 text-red-500" />
              {editMode ? "Edit Menu Item" : "Add New Item"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Item Name *
                  </label>
                  <input
                    placeholder="e.g., Cappuccino"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm({ ...form, categoryId: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm bg-white"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Brief description of the item..."
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex space-x-4 mt-8">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{editMode ? "Update Item" : "Add to Menu"}</span>
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
              />
            </div>
            <div className="flex items-center space-x-2 overflow-x-auto">
              <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-red-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Menu Items Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      item.isActive === false ? "opacity-60 bg-gray-50" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {item.category?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-bold text-red-600">
                        ₹{parseFloat(item.price).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openStockModal(item)}
                        className="flex items-center justify-center space-x-2 mx-auto px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Click to update stock"
                      >
                        {item.inventory?.lowStock && (
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                        )}
                        <span
                          className={`font-semibold ${
                            item.inventory?.quantity === 0
                              ? "text-red-600"
                              : item.inventory?.lowStock
                              ? "text-orange-600"
                              : "text-green-600"
                          }`}
                        >
                          {item.inventory?.quantity ?? 0}
                        </span>
                        <PackagePlus className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className="flex items-center justify-center mx-auto"
                        title={
                          item.isActive !== false
                            ? "Click to deactivate"
                            : "Click to activate"
                        }
                      >
                        {item.isActive !== false ? (
                          <ToggleRight className="w-8 h-8 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No items found</p>
              <p className="text-gray-400 text-sm mt-1">
                {searchTerm
                  ? "Try different search terms"
                  : "Add your first menu item"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Update Modal */}
      {showStockModal && stockItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Update Stock</h3>
              <button
                onClick={() => {
                  setShowStockModal(false);
                  setStockItem(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-lg font-semibold text-gray-900">
                {stockItem.name}
              </p>
              <p className="text-sm text-gray-500">
                {stockItem.category?.name}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Current stock:{" "}
                <span className="font-semibold">
                  {stockItem.inventory?.quantity ?? 0}
                </span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Quantity
              </label>
              <input
                type="number"
                value={newStockQty}
                onChange={(e) => setNewStockQty(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-lg font-semibold text-center"
                min="0"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={updateStock}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 rounded-xl font-semibold transition-all"
              >
                Update Stock
              </button>
              <button
                onClick={() => {
                  setShowStockModal(false);
                  setStockItem(null);
                }}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;

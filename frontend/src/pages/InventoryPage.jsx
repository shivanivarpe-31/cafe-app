import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Search,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  X,
  Save,
  Beaker,
  History,
  ChefHat,
} from "lucide-react";
import Navbar from "../components/navbar";
import { showSuccess, showError, showWarning } from "../utils/toast";

const InventoryPage = () => {
  // State
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("ingredients"); // ingredients, recipes
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Stock modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalType, setStockModalType] = useState("add"); // add, wastage
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockNotes, setStockNotes] = useState("");

  // Recipe modal
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [recipe, setRecipe] = useState([]);

  // Logs modal
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [stockLogs, setStockLogs] = useState([]);

  // Ingredient form
  const [form, setForm] = useState({
    name: "",
    unit: "GRAMS",
    currentStock: "",
    minStock: "10",
    costPerUnit: "",
    supplier: "",
  });

  const units = [
    { value: "GRAMS", label: "Grams (g)" },
    { value: "KG", label: "Kilograms (kg)" },
    { value: "ML", label: "Milliliters (ml)" },
    { value: "LITERS", label: "Liters (L)" },
    { value: "PIECES", label: "Pieces" },
    { value: "CUPS", label: "Cups" },
    { value: "TABLESPOONS", label: "Tablespoons" },
    { value: "TEASPOONS", label: "Teaspoons" },
  ];

  // Fetch data
  const fetchIngredients = useCallback(async () => {
    try {
      const res = await axios.get("/api/ingredients");
      setIngredients(res.data);
    } catch (err) {
      console.error("Failed to fetch ingredients:", err);
    }
  }, []);

  const fetchMenuItems = useCallback(async () => {
    try {
      const res = await axios.get("/api/menu/items");
      setMenuItems(res.data);
    } catch (err) {
      console.error("Failed to fetch menu items:", err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchIngredients(), fetchMenuItems()]);
      setLoading(false);
    };
    loadData();
  }, [fetchIngredients, fetchMenuItems]);

  // Ingredient CRUD
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: form.name,
        unit: form.unit,
        currentStock: parseFloat(form.currentStock) || 0,
        minStock: parseFloat(form.minStock) || 10,
        costPerUnit: parseFloat(form.costPerUnit) || 0,
        supplier: form.supplier,
      };

      if (editMode) {
        await axios.put(`/api/ingredients/${editingId}`, data);
        showSuccess("Ingredient updated!");
      } else {
        await axios.post("/api/ingredients", data);
        showSuccess("Ingredient added!");
      }

      cancelForm();
      fetchIngredients();
    } catch (err) {
      showError("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const handleEdit = (ingredient) => {
    setForm({
      name: ingredient.name,
      unit: ingredient.unit,
      currentStock: ingredient.currentStock.toString(),
      minStock: ingredient.minStock.toString(),
      costPerUnit: ingredient.costPerUnit?.toString() || "",
      supplier: ingredient.supplier || "",
    });
    setEditingId(ingredient.id);
    setEditMode(true);
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ingredient "${name}"?`)) return;

    try {
      await axios.delete(`/api/ingredients/${id}`);
      showSuccess("Ingredient deleted!");
      fetchIngredients();
    } catch (err) {
      showError("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const cancelForm = () => {
    setForm({
      name: "",
      unit: "GRAMS",
      currentStock: "",
      minStock: "10",
      costPerUnit: "",
      supplier: "",
    });
    setShowForm(false);
    setEditMode(false);
    setEditingId(null);
  };

  // Stock management
  const openStockModal = (ingredient, type) => {
    setSelectedIngredient(ingredient);
    setStockModalType(type);
    setStockQuantity("");
    setStockNotes("");
    setShowStockModal(true);
  };

  const handleStockUpdate = async () => {
    if (!stockQuantity || parseFloat(stockQuantity) <= 0) {
      showWarning("Please enter a valid quantity");
      return;
    }

    try {
      const endpoint = stockModalType === "add" ? "add-stock" : "wastage";
      await axios.post(
        `/api/ingredients/${selectedIngredient.id}/${endpoint}`,
        {
          quantity: parseFloat(stockQuantity),
          notes: stockNotes,
        }
      );

      showSuccess(
        `Stock ${stockModalType === "add" ? "added" : "wastage recorded"}!`
      );
      setShowStockModal(false);
      fetchIngredients();
    } catch (err) {
      showError("Error: " + (err.response?.data?.error || err.message));
    }
  };

  // View logs
  const viewLogs = async (ingredient) => {
    try {
      const res = await axios.get(`/api/ingredients/${ingredient.id}/logs`);
      setStockLogs(res.data);
      setSelectedIngredient(ingredient);
      setShowLogsModal(true);
    } catch (err) {
      showError("Failed to fetch logs");
    }
  };

  // Recipe management
  const openRecipeModal = async (menuItem) => {
    try {
      const res = await axios.get(`/api/ingredients/recipe/${menuItem.id}`);
      setSelectedMenuItem(menuItem);
      setRecipe(
        res.data.map((r) => ({
          ingredientId: r.ingredientId,
          ingredientName: r.ingredient.name,
          quantity: r.quantity,
          unit: r.ingredient.unit,
        })),
      );
      setShowRecipeModal(true);
    } catch (err) {
      console.error("Failed to fetch recipe:", err);
      setSelectedMenuItem(menuItem);
      setRecipe([]);
      setShowRecipeModal(true);
    }
  };

  const addRecipeIngredient = () => {
    setRecipe([...recipe, { ingredientId: "", quantity: "" }]);
  };

  const updateRecipeIngredient = (index, field, value) => {
    const updated = [...recipe];
    updated[index][field] = value;
    if (field === "ingredientId") {
      const ing = ingredients.find((i) => i.id === parseInt(value));
      if (ing) {
        updated[index].ingredientName = ing.name;
        updated[index].unit = ing.unit;
      }
    }
    setRecipe(updated);
  };

  const removeRecipeIngredient = (index) => {
    setRecipe(recipe.filter((_, i) => i !== index));
  };

  const saveRecipe = async () => {
    try {
      const validRecipe = recipe.filter(
        (r) => r.ingredientId && r.quantity && parseFloat(r.quantity) > 0,
      );

      await axios.put(`/api/ingredients/recipe/${selectedMenuItem.id}`, {
        ingredients: validRecipe.map((r) => ({
          ingredientId: parseInt(r.ingredientId),
          quantity: parseFloat(r.quantity),
        })),
      });

      showSuccess("Recipe saved!");
      setShowRecipeModal(false);
      fetchMenuItems();
    } catch (err) {
      showError("Error: " + (err.response?.data?.error || err.message));
    }
  };

  // Filter ingredients
  const filteredIngredients = ingredients.filter((ing) =>
    ing.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const lowStockCount = ingredients.filter((ing) => ing.lowStock).length;

  // Get unit label
  const getUnitLabel = (unit) => {
    const u = units.find((u) => u.value === unit);
    return u ? u.label.split(" ")[0] : unit;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center p-16">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Package className="w-7 h-7 mr-3 text-red-500" />
                Inventory Management
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {ingredients.length} ingredients •{" "}
                {lowStockCount > 0 && (
                  <span className="text-orange-600 font-medium">
                    {lowStockCount} low stock alerts
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  fetchIngredients();
                  fetchMenuItems();
                }}
                className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              {activeTab === "ingredients" && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold shadow-md transition-all ${
                    showForm
                      ? "bg-gray-200 text-gray-700"
                      : "bg-gradient-to-r from-red-500 to-red-600 text-white"
                  }`}
                >
                  {showForm ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  <span>{showForm ? "Cancel" : "Add Ingredient"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 mt-6">
            <button
              onClick={() => setActiveTab("ingredients")}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === "ingredients"
                  ? "bg-red-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Beaker className="w-4 h-4 inline mr-2" />
              Ingredients
            </button>
            <button
              onClick={() => setActiveTab("recipes")}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === "recipes"
                  ? "bg-red-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ChefHat className="w-4 h-4 inline mr-2" />
              Recipes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Add/Edit Ingredient Form */}
        {showForm && activeTab === "ingredients" && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <Beaker className="w-6 h-6 mr-2 text-red-500" />
              {editMode ? "Edit Ingredient" : "Add New Ingredient"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    placeholder="e.g., Coffee Powder"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit *
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none bg-white"
                    required
                  >
                    {units.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.currentStock}
                    onChange={(e) =>
                      setForm({ ...form, currentStock: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Minimum Stock (Alert)
                  </label>
                  <input
                    type="number"
                    placeholder="10"
                    value={form.minStock}
                    onChange={(e) =>
                      setForm({ ...form, minStock: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cost Per Unit (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.costPerUnit}
                    onChange={(e) =>
                      setForm({ ...form, costPerUnit: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Supplier
                  </label>
                  <input
                    placeholder="Supplier name"
                    value={form.supplier}
                    onChange={(e) =>
                      setForm({ ...form, supplier: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex space-x-4 mt-8">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-xl font-semibold shadow-md flex items-center justify-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{editMode ? "Update" : "Add Ingredient"}</span>
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={
                activeTab === "ingredients"
                  ? "Search ingredients..."
                  : "Search menu items..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
            />
          </div>
        </div>

        {/* Ingredients Tab */}
        {activeTab === "ingredients" && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">
                      Ingredient
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Current Stock
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Min Stock
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Cost/Unit
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">
                      Used In
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredIngredients.map((ing) => (
                    <tr
                      key={ing.id}
                      className={`hover:bg-gray-50 ${
                        ing.lowStock ? "bg-orange-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {ing.lowStock && (
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">
                              {ing.name}
                            </p>
                            {ing.supplier && (
                              <p className="text-xs text-gray-500">
                                {ing.supplier}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`text-lg font-bold ${
                            ing.currentStock <= 0
                              ? "text-red-600"
                              : ing.lowStock
                              ? "text-orange-600"
                              : "text-green-600"
                          }`}
                        >
                          {ing.currentStock} {getUnitLabel(ing.unit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {ing.minStock} {getUnitLabel(ing.unit)}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        ₹{parseFloat(ing.costPerUnit || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {ing.usedIn?.slice(0, 3).map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                            >
                              {item}
                            </span>
                          ))}
                          {ing.usedIn?.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              +{ing.usedIn.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => openStockModal(ing, "add")}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Add Stock"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openStockModal(ing, "wastage")}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                            title="Record Wastage"
                          >
                            <TrendingDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => viewLogs(ing)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(ing)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ing.id, ing.name)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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

            {filteredIngredients.length === 0 && (
              <div className="text-center py-16">
                <Beaker className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No ingredients found</p>
              </div>
            )}
          </div>
        )}

        {/* Recipes Tab */}
        {activeTab === "recipes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems
              .filter((item) =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase()),
              )
              .map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">
                        {item.category?.name}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-red-600">
                      ₹{parseFloat(item.price).toFixed(0)}
                    </span>
                  </div>

                  <div className="mb-4">
                    {item.ingredients && item.ingredients.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase">
                          Recipe ({item.ingredients.length} ingredients)
                        </p>
                        {item.ingredients.slice(0, 3).map((ing, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm text-gray-600"
                          >
                            <span>{ing.ingredient?.name}</span>
                            <span>
                              {ing.quantity}{" "}
                              {getUnitLabel(ing.ingredient?.unit)}
                            </span>
                          </div>
                        ))}
                        {item.ingredients.length > 3 && (
                          <p className="text-xs text-gray-400">
                            +{item.ingredients.length - 3} more...
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-orange-600 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        No recipe defined
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => openRecipeModal(item)}
                    className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>
                      {item.ingredients?.length > 0
                        ? "Edit Recipe"
                        : "Add Recipe"}
                    </span>
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Stock Modal */}
      {showStockModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {stockModalType === "add" ? "Add Stock" : "Record Wastage"}
              </h3>
              <button
                onClick={() => setShowStockModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="font-semibold text-gray-900">
                {selectedIngredient.name}
              </p>
              <p className="text-sm text-gray-500">
                Current: {selectedIngredient.currentStock}{" "}
                {getUnitLabel(selectedIngredient.unit)}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity ({getUnitLabel(selectedIngredient.unit)})
                </label>
                <input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-lg"
                  min="0"
                  step="0.01"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  placeholder={
                    stockModalType === "add"
                      ? "e.g., Purchased from supplier"
                      : "e.g., Expired items"
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleStockUpdate}
                className={`flex-1 py-3 rounded-xl font-semibold text-white ${
                  stockModalType === "add"
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {stockModalType === "add" ? "Add Stock" : "Record Wastage"}
              </button>
              <button
                onClick={() => setShowStockModal(false)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Modal */}
      {showRecipeModal && selectedMenuItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Edit Recipe</h3>
                <p className="text-sm text-gray-500">{selectedMenuItem.name}</p>
              </div>
              <button
                onClick={() => setShowRecipeModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {recipe.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <select
                    value={item.ingredientId}
                    onChange={(e) =>
                      updateRecipeIngredient(
                        index,
                        "ingredientId",
                        e.target.value,
                      )
                    }
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none bg-white"
                  >
                    <option value="">Select ingredient</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({getUnitLabel(ing.unit)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      updateRecipeIngredient(index, "quantity", e.target.value)
                    }
                    className="w-24 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                    min="0"
                    step="0.01"
                  />
                  <span className="text-sm text-gray-500 w-16">
                    {item.unit ? getUnitLabel(item.unit) : ""}
                  </span>
                  <button
                    onClick={() => removeRecipeIngredient(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}

              <button
                onClick={addRecipeIngredient}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add Ingredient</span>
              </button>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={saveRecipe}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-xl font-semibold"
              >
                Save Recipe
              </button>
              <button
                onClick={() => setShowRecipeModal(false)}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && selectedIngredient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Stock History
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedIngredient.name}
                </p>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3">
              {stockLogs.length > 0 ? (
                stockLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-xl border ${
                      log.quantity > 0
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {log.quantity > 0 ? (
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">
                            {log.changeType.replace("_", " ")}
                          </p>
                          {log.notes && (
                            <p className="text-sm text-gray-500">{log.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            log.quantity > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {log.quantity > 0 ? "+" : ""}
                          {log.quantity} {getUnitLabel(selectedIngredient.unit)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No history available
                </div>
              )}
            </div>

            <button
              onClick={() => setShowLogsModal(false)}
              className="w-full mt-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;

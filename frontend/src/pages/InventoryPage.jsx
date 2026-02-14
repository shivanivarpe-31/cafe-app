import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  RefreshCw,
  X,
  Save,
  Beaker,
  ChefHat,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Boxes,
  TrendingUp,
  DollarSign,
  Keyboard,
  LayoutGrid,
  List,
} from "lucide-react";
import Navbar from "../components/navbar";
import { showSuccess, showError, showWarning } from "../utils/toast";
import { useDebounce } from "../hooks/useDebounce";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import {
  IngredientRow,
  IngredientTableSkeleton,
  StatsCard,
  StatsCardSkeleton,
  getUnitLabel,
} from "../components/inventory/IngredientComponents";
import {
  StockModal,
  RecipeModal,
  LogsModal,
} from "../components/inventory/InventoryModals";
import {
  RecipeCard,
  RecipeCardSkeleton,
} from "../components/inventory/RecipeCard";
import { EmptyState } from "../components/EmptyState";

const InventoryPage = () => {
  // State
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("ingredients"); // ingredients, recipes
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // View & Sort options
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [recipeViewMode, setRecipeViewMode] = useState("grid");

  // Stock modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalType, setStockModalType] = useState("add"); // add, wastage
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [stockSubmitting, setStockSubmitting] = useState(false);

  // Recipe modal
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [recipeSaving, setRecipeSaving] = useState(false);

  // Logs modal
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [stockLogs, setStockLogs] = useState([]);

  // Refs
  const searchInputRef = useRef(null);

  // Debounced search
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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
  const fetchIngredients = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await axios.get("/api/ingredients");
      setIngredients(res.data);
    } catch (err) {
      console.error("Failed to fetch ingredients:", err);
      showError("Failed to load ingredients");
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  const fetchMenuItems = useCallback(async () => {
    try {
      // Use detailed endpoint to get recipe/ingredients data
      const res = await axios.get("/api/menu/items/detailed");
      setMenuItems(res.data);
    } catch (err) {
      console.error("Failed to fetch menu items:", err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchIngredients(), fetchMenuItems()]);
    setRefreshing(false);
  }, [fetchIngredients, fetchMenuItems]);

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
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
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

    setDeleting(id);
    try {
      await axios.delete(`/api/ingredients/${id}`);
      showSuccess("Ingredient deleted!");
      fetchIngredients();
    } catch (err) {
      showError("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setDeleting(null);
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
    setShowStockModal(true);
  };

  const closeStockModal = () => {
    setShowStockModal(false);
    setSelectedIngredient(null);
  };

  const handleStockUpdate = async ({ quantity, notes }) => {
    if (!quantity || quantity <= 0) {
      showWarning("Please enter a valid quantity");
      return;
    }

    setStockSubmitting(true);
    try {
      const endpoint = stockModalType === "add" ? "add-stock" : "wastage";
      await axios.post(
        `/api/ingredients/${selectedIngredient.id}/${endpoint}`,
        { quantity, notes },
      );

      showSuccess(
        `Stock ${stockModalType === "add" ? "added" : "wastage recorded"}!`,
      );
      closeStockModal();
      fetchIngredients();
    } catch (err) {
      showError("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setStockSubmitting(false);
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

  const closeLogsModal = () => {
    setShowLogsModal(false);
    setSelectedIngredient(null);
    setStockLogs([]);
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

  const closeRecipeModal = () => {
    setShowRecipeModal(false);
    setSelectedMenuItem(null);
    setRecipe([]);
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
    setRecipeSaving(true);
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
      closeRecipeModal();
      fetchMenuItems();
    } catch (err) {
      showError("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setRecipeSaving(false);
    }
  };

  // Sorting handler
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "/": () => searchInputRef.current?.focus(),
    n: () => activeTab === "ingredients" && !showForm && setShowForm(true),
    escape: () => {
      if (showForm) cancelForm();
      if (showStockModal) closeStockModal();
      if (showRecipeModal) closeRecipeModal();
      if (showLogsModal) closeLogsModal();
      if (showKeyboardHelp) setShowKeyboardHelp(false);
    },
    "?": () => setShowKeyboardHelp((prev) => !prev),
    r: () => !refreshing && refreshAll(),
    "1": () => setActiveTab("ingredients"),
    "2": () => setActiveTab("recipes"),
    l: () => setFilterLowStock((prev) => !prev),
  });

  // Memoized filtered and sorted ingredients
  const filteredIngredients = useMemo(() => {
    let items = ingredients.filter((ing) =>
      ing.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
    );

    // Filter low stock if enabled
    if (filterLowStock) {
      items = items.filter((ing) => ing.lowStock);
    }

    // Sort
    if (sortConfig.key) {
      items = [...items].sort((a, b) => {
        let aVal, bVal;
        switch (sortConfig.key) {
          case "name":
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case "stock":
            aVal = a.currentStock;
            bVal = b.currentStock;
            break;
          case "cost":
            aVal = a.costPerUnit || 0;
            bVal = b.costPerUnit || 0;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [ingredients, debouncedSearchTerm, filterLowStock, sortConfig]);

  // Memoized filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) =>
      item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
    );
  }, [menuItems, debouncedSearchTerm]);

  // Stats calculations
  const stats = useMemo(() => {
    const totalIngredients = ingredients.length;
    const lowStockCount = ingredients.filter((ing) => ing.lowStock).length;
    const outOfStockCount = ingredients.filter((ing) => ing.currentStock <= 0)
      .length;
    const totalValue = ingredients.reduce(
      (sum, ing) => sum + ing.currentStock * (ing.costPerUnit || 0),
      0,
    );
    const recipesWithIngredients = menuItems.filter(
      (item) => item.ingredients && item.ingredients.length > 0,
    ).length;

    return {
      totalIngredients,
      lowStockCount,
      outOfStockCount,
      totalValue,
      recipesWithIngredients,
      totalRecipes: menuItems.length,
    };
  }, [ingredients, menuItems]);

  // Sort icon component
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-red-500" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-red-500" />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
        <Navbar />
        {/* Skeleton header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-7 bg-gray-200 rounded w-48 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-11 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <div className="h-11 w-28 bg-gray-200 rounded-xl animate-pulse"></div>
              <div className="h-11 w-24 bg-gray-200 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>
        {/* Skeleton content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
          {/* Stats skeleton - Compact */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>
          {/* Table skeleton */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-6">
            <IngredientTableSkeleton rows={6} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100/50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-gradient-to-r from-red-500 to-orange-500 w-8 h-8 rounded-lg flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-white" />
                </span>
                Inventory Management
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  {stats.totalIngredients} ingredients
                </span>
                {stats.lowStockCount > 0 && (
                  <>
                    <span className="mx-2">•</span>
                    <span className="text-orange-600 font-medium inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {stats.lowStockCount} low stock
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Keyboard shortcuts hint */}
              <button
                onClick={() => setShowKeyboardHelp(true)}
                className="hidden sm:flex p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
              </button>
              <button
                onClick={refreshAll}
                disabled={refreshing}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all disabled:opacity-50"
                title="Refresh (R)"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
              {activeTab === "ingredients" && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all text-sm ${
                    showForm
                      ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      : "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                  }`}
                >
                  {showForm ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {showForm ? "Cancel" : "Add Ingredient"}
                  </span>
                  <span className="sm:hidden">
                    {showForm ? "Cancel" : "Add"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
            <button
              onClick={() => setActiveTab("ingredients")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-semibold transition-all text-sm ${
                activeTab === "ingredients"
                  ? "bg-red-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Beaker className="w-4 h-4" />
              <span>Ingredients</span>
              {stats.lowStockCount > 0 && activeTab !== "ingredients" && (
                <span className="w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                  {stats.lowStockCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("recipes")}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-semibold transition-all text-sm ${
                activeTab === "recipes"
                  ? "bg-red-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>Recipes</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* Stats Dashboard - Compact */}
        {activeTab === "ingredients" && !showForm && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatsCard
              icon={Package}
              label="Total Ingredients"
              value={stats.totalIngredients}
              color="blue"
            />
            <StatsCard
              icon={AlertTriangle}
              label="Low Stock"
              value={stats.lowStockCount}
              subValue={
                stats.outOfStockCount > 0
                  ? `${stats.outOfStockCount} out of stock`
                  : undefined
              }
              color={stats.lowStockCount > 0 ? "orange" : "green"}
            />
            <StatsCard
              icon={DollarSign}
              label="Inventory Value"
              value={`₹${stats.totalValue.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}`}
              color="green"
            />
            <StatsCard
              icon={ChefHat}
              label="Recipes Defined"
              value={`${stats.recipesWithIngredients}/${stats.totalRecipes}`}
              subValue={`${Math.round(
                (stats.recipesWithIngredients / stats.totalRecipes) * 100 || 0,
              )}% coverage`}
              color="purple"
            />
          </div>
        )}

        {/* Add/Edit Ingredient Form */}
        {showForm && activeTab === "ingredients" && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-300">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Beaker className="w-5 h-5" />
                {editMode ? "Edit Ingredient" : "Add New Ingredient"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    placeholder="e.g., Coffee Powder"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
                    required
                    autoFocus={!editMode}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm bg-white transition-all cursor-pointer"
                    required
                  >
                    {units.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.currentStock}
                    onChange={(e) =>
                      setForm({ ...form, currentStock: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Min Stock{" "}
                    <span className="text-gray-400">(alert threshold)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="10"
                    value={form.minStock}
                    onChange={(e) =>
                      setForm({ ...form, minStock: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Cost Per Unit (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.costPerUnit}
                      onChange={(e) =>
                        setForm({ ...form, costPerUnit: e.target.value })
                      }
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Supplier <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    placeholder="Supplier name"
                    value={form.supplier}
                    onChange={(e) =>
                      setForm({ ...form, supplier: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={submitting}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{editMode ? "Updating..." : "Adding..."}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editMode ? "Update" : "Add Ingredient"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={
                  activeTab === "ingredients"
                    ? "Search ingredients... (press /)"
                    : "Search menu items... (press /)"
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {activeTab === "ingredients" && (
              <div className="flex items-center gap-2">
                {/* Low stock filter toggle */}
                <button
                  onClick={() => setFilterLowStock(!filterLowStock)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    filterLowStock
                      ? "bg-orange-100 text-orange-700 border border-orange-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="hidden sm:inline">Low Stock</span>
                  {stats.lowStockCount > 0 && (
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded-full ${
                        filterLowStock
                          ? "bg-orange-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {stats.lowStockCount}
                    </span>
                  )}
                </button>

                {/* Sort dropdown */}
                <button
                  onClick={() =>
                    handleSort(
                      sortConfig.key === "name"
                        ? "stock"
                        : sortConfig.key === "stock"
                        ? "cost"
                        : "name",
                    )
                  }
                  className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-600 transition-all"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="hidden sm:inline capitalize">
                    {sortConfig.key}
                  </span>
                  {sortConfig.direction === "asc" ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}

            {activeTab === "recipes" && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setRecipeViewMode("grid")}
                  className={`p-2 rounded-md transition-all ${
                    recipeViewMode === "grid"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRecipeViewMode("list")}
                  className={`p-2 rounded-md transition-all ${
                    recipeViewMode === "list"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {activeTab === "ingredients"
              ? `Showing ${filteredIngredients.length} of ${ingredients.length} ingredients`
              : `Showing ${filteredMenuItems.length} of ${menuItems.length} recipes`}
            {debouncedSearchTerm && ` matching "${debouncedSearchTerm}"`}
          </span>
          {(filterLowStock || searchTerm) && (
            <button
              onClick={() => {
                setFilterLowStock(false);
                setSearchTerm("");
              }}
              className="text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>

        {/* Ingredients Tab */}
        {activeTab === "ingredients" && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <span className="flex items-center gap-2">
                        Ingredient
                        <SortIcon columnKey="name" />
                      </span>
                    </th>
                    <th
                      className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("stock")}
                    >
                      <span className="flex items-center gap-2 justify-center">
                        Stock
                        <SortIcon columnKey="stock" />
                      </span>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                      Min Stock
                    </th>
                    <th
                      className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider hidden md:table-cell cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("cost")}
                    >
                      <span className="flex items-center gap-2 justify-center">
                        Cost/Unit
                        <SortIcon columnKey="cost" />
                      </span>
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                      Used In
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredIngredients.map((ing) => (
                    <IngredientRow
                      key={ing.id}
                      ingredient={ing}
                      onAddStock={(i) => openStockModal(i, "add")}
                      onRecordWastage={(i) => openStockModal(i, "wastage")}
                      onViewLogs={viewLogs}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isDeleting={deleting === ing.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {filteredIngredients.length === 0 && (
              <EmptyState
                icon={Beaker}
                title="No ingredients found"
                message={
                  searchTerm || filterLowStock
                    ? "Try adjusting your search or filters"
                    : "Get started by adding your first ingredient"
                }
                action={
                  !searchTerm &&
                  !filterLowStock && (
                    <button
                      onClick={() => setShowForm(true)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                    >
                      Add First Ingredient
                    </button>
                  )
                }
              />
            )}
          </div>
        )}

        {/* Recipes Tab */}
        {activeTab === "recipes" && (
          <>
            {filteredMenuItems.length > 0 ? (
              <div
                className={
                  recipeViewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
                    : "space-y-3"
                }
              >
                {filteredMenuItems.map((item) => (
                  <RecipeCard
                    key={item.id}
                    item={item}
                    onEditRecipe={openRecipeModal}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ChefHat}
                title="No recipes found"
                message={
                  searchTerm
                    ? "Try adjusting your search"
                    : "Add menu items first to create recipes"
                }
              />
            )}
          </>
        )}
      </div>

      {/* Stock Modal */}
      <StockModal
        isOpen={showStockModal}
        onClose={closeStockModal}
        ingredient={selectedIngredient}
        type={stockModalType}
        onSubmit={handleStockUpdate}
        isSubmitting={stockSubmitting}
      />

      {/* Recipe Modal */}
      <RecipeModal
        isOpen={showRecipeModal}
        onClose={closeRecipeModal}
        menuItem={selectedMenuItem}
        recipe={recipe}
        ingredients={ingredients}
        onAddIngredient={addRecipeIngredient}
        onUpdateIngredient={updateRecipeIngredient}
        onRemoveIngredient={removeRecipeIngredient}
        onSave={saveRecipe}
        isSaving={recipeSaving}
      />

      {/* Logs Modal */}
      <LogsModal
        isOpen={showLogsModal}
        onClose={closeLogsModal}
        ingredient={selectedIngredient}
        logs={stockLogs}
      />

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-gray-400" />
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { key: "/", desc: "Focus search" },
                { key: "N", desc: "Add new ingredient" },
                { key: "R", desc: "Refresh data" },
                { key: "1", desc: "Switch to Ingredients tab" },
                { key: "2", desc: "Switch to Recipes tab" },
                { key: "L", desc: "Toggle low stock filter" },
                { key: "Esc", desc: "Close modals / Cancel" },
                { key: "?", desc: "Toggle this help" },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-600">{desc}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono font-medium text-gray-700 border border-gray-200">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;

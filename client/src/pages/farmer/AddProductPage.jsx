"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { createProduct, resetProductSuccess, clearProductError } from "../../redux/slices/productSlice";
import Loader from "../../components/Loader";
import { FaUpload, FaTimes, FaLeaf } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_URL } from "../../config/api";

const AddProductPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { loading, success, error } = useSelector((state) => state.products);
  
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    unit: "kg",
    quantityAvailable: "",
    images: [], 
    isOrganic: false,
  });

  const [imagePreviewUrls, setImagePreviewUrls] = useState([]);
  const [errors, setErrors] = useState({});

  // AddProductPage.jsx mein pehle useEffect ko aise update karein:
useEffect(() => {
  // Purane errors clear karein taaki loading state reset ho sake
  dispatch(clearProductError());
  dispatch(resetProductSuccess());

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const { data } = await axios.get(`${API_URL}/categories`);
      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
      toast.error("Could not load categories.");
    } finally {
      setCategoriesLoading(false);
    }
  };
  fetchCategories();
}, [dispatch]); // dispatch add karein dependency mein

  useEffect(() => {
    if (success) {
      toast.success("Product listed successfully!");
      dispatch(resetProductSuccess());
      navigate("/farmer/products");
    }
    if (error) {
      toast.error(error);
      dispatch(clearProductError());
    }
  }, [success, error, dispatch, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);
    
    if (validFiles.length < files.length) {
      toast.warning("Some images exceeded 5MB and were skipped.");
    }

    const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
    setImagePreviewUrls((prev) => [...prev, ...newPreviews]);

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...validFiles],
    }));

    if (errors.images) setErrors(prev => ({ ...prev, images: null }));
  };

  const removeImage = (index) => {
    const newPreviews = [...imagePreviewUrls];
    const newImages = [...formData.images];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    newImages.splice(index, 1);
    setImagePreviewUrls(newPreviews);
    setFormData((prev) => ({ ...prev, images: newImages }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Product name is required";
    if (!formData.category) newErrors.category = "Please select a category";
    if (!formData.price || formData.price <= 0) newErrors.price = "Valid price is required";
    if (!formData.quantityAvailable || formData.quantityAvailable < 0) {
        newErrors.quantityAvailable = "Available quantity is required";
    }
    if (formData.images.length === 0) {
        newErrors.images = "At least one product image is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // UPDATED SUBMIT LOGIC
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Explicit check for images to prevent backend validation triggers
    if (formData.images.length === 0) {
      toast.error("Please upload at least one image before launching.");
      return;
    }

    if (validateForm()) {
      const data = new FormData();
      
      // Mapping frontend fields to backend expected fields
      data.append("name", formData.name);
      data.append("description", formData.description);
      data.append("category", formData.category);
      data.append("price", Number(formData.price)); // Explicit conversion
      data.append("unit", formData.unit);
      data.append("isOrganic", formData.isOrganic);
      data.append("quantityAvailable", Number(formData.quantityAvailable)); // Explicit conversion

      // Ensure images are appended as an array of files
      formData.images.forEach((file) => {
        data.append("images", file); 
      });

      dispatch(createProduct(data));
    } else {
      toast.error("Please fill all required fields correctly.");
    }
  };

  //if (loading || categoriesLoading) return <Loader />;
  if (categoriesLoading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="flex items-center space-x-3 mb-8 border-b pb-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-2xl">
             <FaLeaf size={24} />
          </div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight uppercase">New Product Listing</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Product Name*</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className={`w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-green-500 font-bold transition ${errors.name ? 'ring-2 ring-red-500 bg-red-50' : ''}`} placeholder="e.g. Fresh Red Onions" />
              {errors.name && <p className="text-red-500 text-xs mt-2 font-bold ml-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Category*</label>
              <select name="category" value={formData.category} onChange={handleChange} className={`w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-green-500 font-bold transition ${errors.category ? 'ring-2 ring-red-500 bg-red-50' : ''}`}>
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-2 font-bold ml-1">{errors.category}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Description</label>
            <textarea name="description" rows="3" value={formData.description} onChange={handleChange} className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-green-500 font-medium" placeholder="Describe quality..."></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Price (₨)*</label>
              <input type="number" name="price" value={formData.price} onChange={handleChange} className={`w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-green-500 font-bold ${errors.price ? 'ring-2 ring-red-500' : ''}`} />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Unit</label>
              <select name="unit" value={formData.unit} onChange={handleChange} className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-green-500 font-bold">
                <option value="kg">kg</option>
                <option value="gram">gram</option>
                <option value="piece">bunch</option>
                <option value="dozen">dozen</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase mb-2 ml-1">Quantity Available*</label>
              <input type="number" name="quantityAvailable" value={formData.quantityAvailable} onChange={handleChange} className={`w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-green-500 font-bold ${errors.quantityAvailable ? 'ring-2 ring-red-500 bg-red-50' : ''}`} />
            </div>
          </div>

          <div className={`bg-green-50 p-6 rounded-[2rem] border transition-all ${errors.images ? 'border-red-300 bg-red-50' : 'border-green-100'}`}>
            <label className="block text-xs font-black text-green-700 uppercase mb-4 tracking-widest ml-1">Photos*</label>
            <div className="flex flex-wrap gap-4">
              <label className="w-24 h-24 flex flex-col items-center justify-center bg-white border-2 border-dashed border-green-300 rounded-2xl cursor-pointer hover:bg-green-100 transition text-green-600 shadow-sm">
                <FaUpload size={24} />
                <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>

              {imagePreviewUrls.map((url, index) => (
                <div key={index} className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-lg border-2 border-white">
                  <img src={url} alt="preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md">
                    <FaTimes size={10}/>
                  </button>
                </div>
              ))}
            </div>
            {errors.images && <p className="text-red-500 text-xs mt-3 font-bold ml-1 uppercase">{errors.images}</p>}
          </div>

          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl w-fit">
            <input type="checkbox" name="isOrganic" checked={formData.isOrganic} onChange={handleChange} className="w-5 h-5 text-green-600 rounded" />
            <label className="text-sm font-black text-gray-700 uppercase tracking-tight">Certified Organic Product</label>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black text-xl hover:bg-green-700 transition shadow-xl active:scale-95 disabled:bg-gray-400 uppercase tracking-widest">
            {loading ? "Publishing..." : "Launch Product Listing"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddProductPage;

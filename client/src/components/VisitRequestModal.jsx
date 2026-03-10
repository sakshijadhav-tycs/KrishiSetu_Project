import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import axios from "axios";
import { toast } from "react-hot-toast";

const VisitRequestModal = ({ isOpen, onClose, farmerId, farmerName }) => {
    const [date, setDate] = useState(new Date());
    const [slot, setSlot] = useState("");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);

    // Time slots
    const timeSlots = ["10:00 AM - 12:00 PM", "02:00 PM - 04:00 PM", "04:00 PM - 06:00 PM"];

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!date || !slot) {
            return toast.error("Please select date and time slot");
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            };
            const url = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/visits`;
            console.log("Visit Request URL:", url);

            await axios.post(
                url,
                {
                    farmerId,
                    date,
                    slot,
                    notes,
                },
                config
            );

            toast.success("Visit Request Sent Successfully!");
            onClose(); // Close modal on success
            setSlot("");
            setNotes("");
        } catch (error) {
            console.error("Error creating visit:", error);
            toast.error(error.response?.data?.message || "Failed to send request");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl animate-scale-up">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Request Visit: {farmerName}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 font-bold"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2">Select Date</label>
                        <DatePicker
                            selected={date}
                            onChange={(date) => setDate(date)}
                            minDate={new Date()}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            dateFormat="MMMM d, yyyy"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2">Time Slot</label>
                        <select
                            value={slot}
                            onChange={(e) => setSlot(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        >
                            <option value="">Select a Slot</option>
                            {timeSlots.map((ts) => (
                                <option key={ts} value={ts}>{ts}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2">Notes (Optional)</label>
                        <textarea
                            rows="3"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="E.g., I want to see your organic mango farm..."
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                        >
                            {loading ? "Sending..." : "Send Request"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VisitRequestModal;

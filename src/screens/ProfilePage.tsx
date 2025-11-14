import React, { useEffect, useState } from 'react';
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt } from 'react-icons/fa';
import basil from '../assets/FE.jpg';
import { FaAnchor } from 'react-icons/fa6';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

// Define the interface for engineer data
interface FieldEngineer {
  id: number;
  name: string;
  lat: number;
  lng: number;
  status: string;
  lastUpdated: string;
  phone?: string;
  email?: string;
  assignedBranch?: string;
  currentTask?: string;
}

const ProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const [engineer, setEngineer] = useState<FieldEngineer | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    // Try to get engineer data from location state first
    const engineerFromState = location.state?.engineerData;
    
    // Get logged-in user data from localStorage
    const loggedInUsername = localStorage.getItem('username') || 'Admin User';
    const loggedInEmail = localStorage.getItem('email') || 'admin@equicom.com';
    const loggedInRole = localStorage.getItem('role') || 'admin';
    
    useEffect(() => {
        // If we have the engineer data from navigation state, use it
        if (engineerFromState) {
            setEngineer(engineerFromState);
            return;
        }
        
        // Otherwise fetch it from the API
        const fetchEngineer = async () => {
            if (!id) return;
            
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:5242/api/FieldEngineer/${id}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                const data = await response.json();
                setEngineer(data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching engineer data:', err);
                setError('Failed to load engineer profile.');
                setLoading(false);
            }
        };
        
        fetchEngineer();
    }, [id, engineerFromState]);
    
    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen flex justify-center items-center p-4 bg-[#6b6f1d]">
                <span className="loading loading-spinner loading-lg text-white"></span>
            </div>
        );
    }
    
    // Show error state
    if (error) {
        return (
            <div className="min-h-screen p-4 bg-[#6b6f1d]">
                <div className="max-w-4xl mx-auto">
                    <div className="alert alert-error">
                        <span>{error}</span>
                        <button className="btn btn-sm" onClick={() => navigate(-1)}>Go Back</button>
                    </div>
                </div>
            </div>
        );
    }
    
    // Default profile data (for admin or when no engineer is selected)
    const profileData = engineer ? {
        name: engineer.name,
        position: "Field Engineer",
        email: engineer.email || "Not provided",
        phone: engineer.phone || "Not provided",
        location: `Lat: ${engineer.lat.toFixed(6)}, Lng: ${engineer.lng.toFixed(6)}`,
        status: engineer.status,
        branch: engineer.assignedBranch || "Unassigned",
        initial: engineer.name.charAt(0).toUpperCase(),
    } : {
        name: loggedInUsername,
        position: loggedInRole === 'admin' ? 'System Administrator' : 'User',
        email: loggedInEmail,
        phone: "Not provided",
        location: "Head Office",
        status: "active",
        branch: "Administration",
        initial: loggedInUsername.charAt(0).toUpperCase(),
    };

    return (
        <div className="min-h-screen p-4 bg-[#6b6f1d]">
            <div className="max-w-4xl mx-auto">
                <div className="relative mb-8">
                    {/* Back Button */}
                    <button 
                        className="btn btn-outline btn-sm absolute left-0" 
                        onClick={() => navigate(-1)}
                    >
                        Back
                    </button>
                    
                    {/* Centered Heading */}
                    <h1 className="text-3xl font-bold text-center text-white">
                        {engineer ? `${engineer.name}'s Profile` : 'My Profile'}
                    </h1>
                </div>
                
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Profile Picture Section */}
                            <div className="flex flex-col items-center">
                                <div className="avatar">
                                    <div className="w-48 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                        <div className="text-6xl font-bold text-white flex items-center justify-center h-48 w-48 rounded-full bg-gray-500">
                                            {profileData.initial}
                                        </div>
                                    </div>
                                </div>
                                <div className={`badge mt-4 ${
                                    profileData.status === 'active' ? 'badge-success' : 
                                    profileData.status === 'on assignment' ? 'badge-warning' : 
                                    'badge-neutral'
                                }`}>
                                    {profileData.status.charAt(0).toUpperCase() + profileData.status.slice(1)}
                                </div>
                            </div>
                            
                            {/* Profile Info Section */}
                            <div className="flex-1">
                                <div className="stats stats-vertical w-full bg-base-200 text-base-content">
                                    <div className="stat">
                                        <div className="stat-title flex items-center">
                                            <FaUser className="mr-2" /> Name
                                        </div>
                                        <div className="stat-value text-xl">{profileData.name}</div>
                                    </div>

                                    <div className="stat">
                                        <div className="stat-title flex items-center">
                                            <FaAnchor className="mr-2" /> Position
                                        </div>
                                        <div className="stat-value text-xl">{profileData.position}</div>
                                    </div>
                                    
                                    <div className="stat">
                                        <div className="stat-title flex items-center">
                                            <FaEnvelope className="mr-2" /> Email
                                        </div>
                                        <div className="stat-value text-xl">{profileData.email}</div>
                                    </div>
                                    
                                    <div className="stat">
                                        <div className="stat-title flex items-center">
                                            <FaPhone className="mr-2" /> Phone
                                        </div>
                                        <div className="stat-value text-xl">{profileData.phone}</div>
                                    </div>
                                    
                                    <div className="stat">
                                        <div className="stat-title flex items-center">
                                            <FaMapMarkerAlt className="mr-2" /> {engineer ? 'Location' : 'Department'}
                                        </div>
                                        <div className="stat-value text-xl">{profileData.location}</div>
                                    </div>
                                    
                                    <div className="stat">
                                        <div className="stat-title flex items-center">
                                            <FaMapMarkerAlt className="mr-2" /> {engineer ? 'Assigned Branch' : 'Division'}
                                        </div>
                                        <div className="stat-value text-xl">{profileData.branch}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Only show stats for Field Engineers */}
                        {engineer && (
                            <div className="stats shadow mt-6">
                                <div className="stat">
                                    <div className="stat-figure text-primary">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        className="inline-block h-8 w-8 stroke-green-300"
                                    >
                                        <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                        ></path>
                                    </svg>
                                    </div>
                                    <div className="stat-title">Rating</div>
                                    <div className="stat-value text-green-300 ">8/10</div>
                                    <div className="stat-desc">1% increase since last month</div>
                                </div>

                                <div className="stat">
                                    <div className="stat-figure text-secondary">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        className="inline-block h-8 w-8 stroke-current"
                                    >
                                        <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M13 10V3L4 14h7v7l9-11h-7z"
                                        ></path>
                                    </svg>
                                    </div>
                                    <div className="stat-title">Service Request</div>
                                    <div className="stat-value text-secondary">98</div>
                                    <div className="stat-desc">21% more than last month</div>
                                </div>

                                <div className="stat">
                                    <div className="stat-figure text-secondary">
                                    <div className="avatar avatar-online">
                                        <div className="w-16 rounded-full">
                                        <img src={basil} />
                                        </div>
                                    </div>
                                    </div>
                                    <div className="stat-value">86%</div>
                                    <div className="stat-title">Tasks done</div>
                                    <div className="stat-desc text-secondary">31 tasks remaining</div>
                                </div>
                            </div>
                        )}
                        
                        {/* Only show these sections for admins or non-engineer profiles */}
                        {!engineer && (
                            <>
                                <div className="divider">About</div>
                                <div className="bg-base-200 p-4 rounded-lg">
                                    <p>System administrator with access to DOROTI Web Admin platform for managing field engineers and monitoring operations.</p>
                                </div>
                                
                                <div className="divider">Account Settings</div>
                                <div className="flex flex-col gap-2">
                                    <button className="btn btn-outline">Change Password</button>
                                    <button className="btn btn-outline">Privacy Settings</button>
                                    <button className="btn btn-outline btn-error" onClick={() => {
                                        localStorage.clear();
                                        navigate('/login');
                                    }}>Logout</button>
                                </div>
                            </>
                        )}
                        
                        {/* Add engineer-specific sections */}
                        {engineer && (
                            <>
                                <div className="divider">Current Task</div>
                                <div className="bg-base-200 p-4 rounded-lg">
                                    <p>{engineer.currentTask || "No current task assigned"}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
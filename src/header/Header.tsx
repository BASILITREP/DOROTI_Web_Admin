import type { FC } from "react";
import equicomLogo from "../assets/equicomLogo.png";

import { useNavigate } from "react-router-dom";

interface HeaderProps {
  activePage?: "dashboard" | "fieldEngineers" | "activity";
}

const Header: FC<HeaderProps> = ({ activePage = "dashboard" }) => {
  const navigate = useNavigate();

  const loggedInUsername = localStorage.getItem("username") || "Admin User";
  const userInitial = loggedInUsername.charAt(0).toUpperCase();

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "☀️", href: "/" },
    
    { id: "fieldEngineers", label: "Field Engineers", icon: "👷", href: "/field-engineers" },
  ];

  return (
    <div className="absolute top-3 left-80 transform -translate-x-1/2 z-10">
      <div className="flex items-center gap-3 bg-transparent  px-4 py-2 rounded-full ">
        {/* Logo */}
        <img src={equicomLogo} alt="Equicom Logo" className="h-12" />
        {/* Profile */}
        {/* Profile - Avatar with Initial */}
        <div
          onClick={handleProfileClick}
          className="flex items-center ml-2 cursor-pointer hover:bg-gray-100 rounded-full px-2 py-1"
        >
          <div className="avatar placeholder">
            <div className="w-8 h-8 rounded-full bg-[#6b6f1d]/95 text-neutral-content border border-gray-300">
              {/* Center the letter */}
              <span className="text-lg font-bold items-center justify-center flex">{userInitial}</span>
            </div>
          </div>
        </div>

        {/* Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.href)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full border shadow-sm transition-all ${

                activePage === item.id
                  ? "bg-[#6b6f1d] text-white border-[#6b6f1d]"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Header;

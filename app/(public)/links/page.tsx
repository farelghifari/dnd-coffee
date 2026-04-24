"use client";

import React, { useState, useEffect, useRef } from 'react';
import config from '@/lib/links-config.json';
import './links.css';
import { 
  MapPin, 
  ShoppingBag, 
  MessageCircle, 
  FileText, 
  Instagram, 
  Globe, 
  ExternalLink, 
  ChevronRight,
  Clock,
  Coffee,
  Moon,
  Sun,
  Copy,
  Check,
  Facebook,
  Twitter,
  Youtube,
  Send,
  Music
} from 'lucide-react';

const iconMap: Record<string, any> = {
  MapPin, ShoppingBag, MessageCircle, FileText, Instagram, Globe, ExternalLink, Send, Music
};

const socialIconMap: Record<string, any> = {
  Instagram, Facebook, Twitter, Youtube, TikTok: Music, WhatsApp: MessageCircle
};

export default function LinksPage() {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('bio-theme');
    if (savedTheme === 'light') setIsDarkMode(false);
  }, []);

  if (!mounted) return <div className="links-page-wrapper dark" />;

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('bio-theme', newTheme ? 'dark' : 'light');
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`links-page-wrapper ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="bg-glow" />
      
      <div className="links-container">
        {/* Top Controls */}
        <button className="theme-switcher" onClick={toggleTheme} aria-label="Toggle Theme">
          {isDarkMode ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
        </button>

        {/* Header Section */}
        <header className="header fade-in">
          <div className="logo-wrapper">
            <div className="logo-container">
              {config.logo === "/images/logo-placeholder.png" ? (
                <Coffee size={40} strokeWidth={1.5} color={isDarkMode ? "#fff" : "#000"} />
              ) : (
                <img src={config.logo} alt={config.shopName} />
              )}
            </div>
          </div>
          <h1 className="shop-name">{config.shopName}</h1>
          <p className="tagline">{config.tagline}</p>
        </header>

        {/* Promo Banners */}
        <div className="promos-wrapper fade-in delay-1">
          {config.promos
            .filter(p => p.enabled)
            .map((p, idx) => (
              <div 
                key={idx} 
                className="promo-banner" 
                style={{ background: p.bg, color: p.color, marginBottom: '12px' }}
              >
                <span>{p.text}</span>
              </div>
            ))
          }
        </div>

        {/* Featured Menu - High UX Scroll */}
        <section className="fade-in delay-2">
          <div className="section-header">
            <h2 className="section-title">Chef's Recommendations</h2>
          </div>
          <div className="featured-scroll">
            {config.featuredMenu.map((item, idx) => (
              <div key={idx} className="menu-card">
                <div className="card-img-wrapper">
                  <img src={item.image} alt={item.name} className="menu-img" />
                </div>
                <div className="menu-info">
                  <p className="menu-name">{item.name}</p>
                  <span className="menu-price">{item.price}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Main Links Area */}
        <section className="links-section fade-in delay-3">
          <div className="section-header">
            <h2 className="section-title">Quick Actions</h2>
          </div>
          {config.quickLinks
            .filter(link => link.visible)
            .map((link, idx) => {
              const Icon = iconMap[link.icon] || ExternalLink;
              return (
                <a 
                  key={idx} 
                  href={link.url} 
                  className={`link-button ${link.highlight ? 'highlight' : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="link-content">
                    <div className="link-icon-box">
                      <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <span>{link.label}</span>
                  </div>
                  <ChevronRight size={18} strokeWidth={1.5} opacity={0.4} />
                </a>
              );
            })}
        </section>

        {/* Info Grid: Hours & Minimal Map */}
        <section className="info-row fade-in delay-4">
          <div className="hours-card">
            <div className="section-header" style={{ marginBottom: '16px' }}>
              <h2 className="section-title">Hours</h2>
            </div>
            {config.operatingHours.map((hour, idx) => (
              <div key={idx} className="hour-item">
                <span className="hour-label">{hour.days}</span>
                <span className="hour-value">{hour.time}</span>
              </div>
            ))}
          </div>
          <div className="map-card" onClick={() => window.open('https://maps.google.com', '_blank')}>
            <iframe
              title="Mini Map"
              width="100%"
              height="100%"
              frameBorder="0"
              src={config.googleMapsEmbedUrl}
              style={{ pointerEvents: 'none' }}
            />
          </div>
        </section>

        {/* Footer & Socials */}
        <footer className="footer fade-in delay-4">
          <div className="social-bar">
            {config.socials.map((social, idx) => {
              const SocialIcon = socialIconMap[social.platform] || Instagram;
              return (
                <a key={idx} href={social.url} className="social-link" target="_blank" rel="noopener noreferrer">
                  <SocialIcon size={22} strokeWidth={1.5} />
                </a>
              );
            })}
          </div>
          
          <button className="link-button" onClick={copyUrl} style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', borderStyle: 'dashed' }}>
             <div className="link-content">
                {copied ? <Check size={18} color="#22c55e" /> : <Send size={18} opacity={0.5} />}
                <span style={{ fontSize: '13px', opacity: 0.5 }}>{copied ? 'Copied to clipboard' : 'Share Bio Link'}</span>
             </div>
          </button>
          
          <p style={{ marginTop: '32px', fontSize: '11px', opacity: 0.3, letterSpacing: '1px' }}>
            Powered by D&D Coffee Experience
          </p>
        </footer>
      </div>
    </div>
  );
}

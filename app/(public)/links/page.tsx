"use client";

import React, { useState, useEffect } from 'react';
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
  Coffee,
  Moon,
  Sun,
  Send,
  Music,
  Check
} from 'lucide-react';

const iconMap: Record<string, any> = {
  MapPin, ShoppingBag, MessageCircle, FileText, Instagram, Globe, ExternalLink, Send, Music
};

const socialIconMap: Record<string, any> = {
  Instagram, TikTok: Music, WhatsApp: MessageCircle
};

export default function LinksPage() {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="links-page-wrapper" />;

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="links-page-wrapper">
      <div className="bg-glow" />
      
      <div 
        className="links-container"
        style={config.backgroundImage ? { 
          '--bg-image': `url(${config.backgroundImage})`
        } as any : {}}
      >
        <div className="bg-overlay" />

        {/* Header */}
        <header className="header fade-in">
          <div className="logo-container">
            {config.logo === "/images/logo-placeholder.png" ? (
              <Coffee size={48} strokeWidth={1.2} color="#fff" />
            ) : (
              <img src={config.logo} alt={config.shopName} className="menu-img" />
            )}
          </div>
          <h1 className="shop-name">{config.shopName}</h1>
          <div className="tagline">{config.tagline}</div>
        </header>

        {/* Promo Banners */}
        <div className="promos-wrapper fade-in delay-1">
          {config.promos
            .filter(p => p.enabled)
            .map((p, idx) => (
              <div 
                key={idx} 
                className="promo-banner" 
                style={{ background: p.bg, color: p.color, marginBottom: '16px' }}
              >
                <span>{p.text}</span>
              </div>
            ))
          }
        </div>

        {/* Menu Section */}
        <section className="fade-in delay-2" style={{ marginTop: '24px' }}>
          <div className="section-header">
            <h3 className="section-title">Chef's Recommendations</h3>
          </div>
          <div className="featured-scroll">
            {config.featuredMenu.map((item, idx) => (
              <div key={idx} className="menu-card">
                <div className="card-img-wrapper">
                  <img src={item.image} alt={item.name} className="menu-img" />
                </div>
                <p className="menu-name">{item.name}</p>
                <span className="menu-price">{item.price}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section className="links-section fade-in delay-3">
          <div className="section-header">
            <h3 className="section-title">Quick Actions</h3>
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
                  <div className="link-content" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="link-icon-box">
                      <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <span>{link.label}</span>
                  </div>
                  <ChevronRight size={18} strokeWidth={1.5} opacity={0.3} />
                </a>
              );
            })}
        </section>

        {/* Info Row */}
        <section className="info-row fade-in delay-4">
          <div className="hours-card">
            <div className="section-header" style={{ marginBottom: '16px' }}>
              <h3 className="section-title">Operating Hours</h3>
            </div>
            {config.operatingHours.map((hour, idx) => (
              <div key={idx} className="hour-item">
                <span className="hour-label">{hour.days}</span>
                <span className="hour-value">{hour.time}</span>
              </div>
            ))}
          </div>
          <div className="map-card" onClick={() => window.open('https://maps.google.com', '_blank')} style={{ cursor: 'pointer' }}>
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

        {/* Footer */}
        <footer className="footer fade-in delay-4">
          <div className="social-bar">
            {config.socials.map((social, idx) => {
              const SocialIcon = socialIconMap[social.platform] || Instagram;
              return (
                <a key={idx} href={social.url} className="social-link" target="_blank" rel="noopener noreferrer">
                  <SocialIcon size={24} strokeWidth={1.5} />
                </a>
              );
            })}
          </div>
          
          <button 
            className="link-button" 
            onClick={copyUrl} 
            style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', borderStyle: 'dashed' }}
          >
             <div className="link-content" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {copied ? <Check size={18} color="#22c55e" /> : <Send size={18} opacity={0.4} />}
                <span style={{ fontSize: '14px', opacity: 0.5 }}>{copied ? 'Copied to clipboard' : 'Share Bio Link'}</span>
             </div>
          </button>
          
          <p style={{ marginTop: '40px', fontSize: '10px', opacity: 0.3, letterSpacing: '2px', textTransform: 'uppercase' }}>
            Powered by {config.shopName}
          </p>
        </footer>
      </div>
    </div>
  );
}

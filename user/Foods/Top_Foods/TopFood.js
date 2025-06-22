import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import axios from 'axios';
import * as Location from 'expo-location';
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import TopFoodCard from './TopFoodCard';
import { styles } from './FoodStyles';
import { useLocation } from '../../context/LocationContext';

// Define storage key for cached location
const LOCATION_CACHE_KEY = 'cached_user_location';

// Restaurant categories
const CATEGORIES = ['All', 'Veg', 'Non-Veg', 'Veg-Non-Veg'];

export default function TopFood({ show = false, refreshing, onRefresh }) {
    const isMounted = useRef(true);

    const [foodData, setFoodData] = useState([]);
    const [originalFoodData, setOriginalFoodData] = useState([]);
    const { location } = useLocation()
    const [showAll, setShowAll] = useState(show);
    const [loading, setLoading] = useState(true);
    const [loadingText, setLoadingText] = useState('Finding restaurants near you...');
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [priceSort, setPriceSort] = useState(null); // null, 'asc', 'desc'
    const [showFilters, setShowFilters] = useState(false);
    const navigation = useNavigation();

    const fetchRestaurants = async () => {
        if (!isMounted.current) return;

        try {
            setLoading(true);



            const { latitude, longitude } = location.coords;
            console.log("Latitude:", latitude, "Longitude:", longitude);

            setLoadingText('Finding restaurants near you...');

            // Fetch restaurants based on location
            const response = await axios.get(`https://appapi.olyox.com/api/v1/tiffin/find_RestaurantTop`, {
                params: {
                    lat: latitude,
                    lng: longitude
                },
                timeout: 8000
            });

            if (response.data?.data?.length > 0) {
                // Shuffle the restaurant data for variety
                const shuffledData = shuffleArray([...response.data.data]);
                setOriginalFoodData(shuffledData);
                setFoodData(shuffledData);
            } else {
                setError('No top restaurants found in your area.');
            }
        } catch (error) {
            console.error("Food Error:", error.response?.data?.message || error.message);
            setError('Something went wrong while fetching restaurants.');
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    };

    // Fisher-Yates shuffle algorithm
    const shuffleArray = (array) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    // Apply filters and search
    const applyFiltersAndSearch = () => {
        let filteredData = [...originalFoodData];

        // Apply category filter
        if (selectedCategory !== 'All') {
            filteredData = filteredData.filter(
                restaurant => restaurant.restaurant_category === selectedCategory
            );
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filteredData = filteredData.filter(
                restaurant => restaurant.restaurant_name.toLowerCase().includes(query)
            );
        }

        // Apply price sort
        if (priceSort === 'asc') {
            filteredData.sort((a, b) => a.priceForTwoPerson - b.priceForTwoPerson);
        } else if (priceSort === 'desc') {
            filteredData.sort((a, b) => b.priceForTwoPerson - a.priceForTwoPerson);
        }

        setFoodData(filteredData);
    };

    // Handle search input changes
    const handleSearch = (text) => {
        setSearchQuery(text);
    };

    // Handle manual refresh
    const handleRefresh = () => {
        setSearchQuery('');
        setSelectedCategory('All');
        setPriceSort(null);
        fetchRestaurants();
    };

    useEffect(() => {
        fetchRestaurants();

        return () => {
            isMounted.current = false;
        };
    }, [refreshing]);

    // Apply filters when any filter changes
    useEffect(() => {
        if (originalFoodData.length > 0) {
            applyFiltersAndSearch();
        }
    }, [searchQuery, selectedCategory, priceSort]);

    const displayedRestaurants = showAll ? foodData : foodData.slice(0, 4);

    const renderLoader = () => (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#FF6B00" />
            <Text style={styles.loaderText}>{loadingText}</Text>
        </View>
    );

    const renderFilters = () => (
        <View style={styles.filtersContainer}>
            {/* Search bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search restaurants..."
                    value={searchQuery}
                    onChangeText={handleSearch}
                    placeholderTextColor="#888"
                />
                {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                        <Ionicons name="close-circle" size={20} color="#888" />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Filter options */}
            {showFilters && (
                <View style={styles.filterOptionsContainer}>
                    {/* Category filter */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterLabel}>Category:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollView}>
                            {CATEGORIES.map((category) => (
                                <TouchableOpacity
                                    key={category}
                                    style={[
                                        styles.categoryChip,
                                        selectedCategory === category && styles.selectedCategoryChip
                                    ]}
                                    onPress={() => setSelectedCategory(category)}
                                >
                                    <Text
                                        style={[
                                            styles.categoryChipText,
                                            selectedCategory === category && styles.selectedCategoryChipText
                                        ]}
                                    >
                                        {category}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Price filter */}
                    <View style={styles.filterSection}>
                        <Text style={styles.filterLabel}>Price:</Text>
                        <View style={styles.priceButtonsContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.priceButton,
                                    priceSort === 'asc' && styles.selectedPriceButton
                                ]}
                                onPress={() => setPriceSort(priceSort === 'asc' ? null : 'asc')}
                            >
                                <Text style={styles.priceButtonText}>Low to High</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.priceButton,
                                    priceSort === 'desc' && styles.selectedPriceButton
                                ]}
                                onPress={() => setPriceSort(priceSort === 'desc' ? null : 'desc')}
                            >
                                <Text style={styles.priceButtonText}>High to Low</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Top Restaurants</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => setShowFilters(!showFilters)}>
                        <Ionicons name={showFilters ? "options" : "options-outline"} size={24} color="#FF6B00" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={handleRefresh}>
                        <Ionicons name="refresh" size={24} color="#FF6B00" />
                    </TouchableOpacity>
                    {foodData.length > 4 && (
                        <TouchableOpacity style={styles.viewAllButton} onPress={() => setShowAll(!showAll)}>
                            <Text style={styles.viewAllText}>
                                {showAll ? 'Show Less' : 'View All'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {renderFilters()}

            {loading ? (
                renderLoader()
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                            setError('');
                            fetchRestaurants();
                        }}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.resultsContainer}>
                    {displayedRestaurants.length > 0 ? (
                        <>
                            <Text style={styles.resultCount}>
                                Found {foodData.length} restaurant{foodData.length !== 1 ? 's' : ''}
                            </Text>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.cardsContainer}>
                                    {displayedRestaurants.map((restaurant) => (
                                        <TopFoodCard
                                            key={restaurant._id}
                                            restaurant={restaurant}
                                            onPress={() => navigation.navigate('restaurants_page', { item: restaurant?._id })}
                                        />
                                    ))}
                                </View>
                            </ScrollView>
                        </>
                    ) : (
                        <View style={styles.noResultsContainer}>
                            <Ionicons name="restaurant-outline" size={56} color="#DDD" />
                            <Text style={styles.noResultsText}>No restaurants match your search</Text>
                            <TouchableOpacity style={styles.resetButton} onPress={() => {
                                setSearchQuery('');
                                setSelectedCategory('All');
                                setPriceSort(null);
                            }}>
                                <Text style={styles.resetButtonText}>Reset Filters</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}


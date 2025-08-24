#!/usr/bin/env python3
"""
Test script for the updated advanced dataset manager
"""
import asyncio
import sys
import os
from pathlib import Path

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.advanced_dataset_manager import AdvancedDatasetManager

async def test_dataset_manager():
    """Test the dataset manager functionality"""
    print("🚀 Testing Advanced Dataset Manager")
    print("=" * 60)
    
    # Initialize dataset manager
    manager = AdvancedDatasetManager(data_dir="./test_datasets")
    
    try:
        print("\n1. Testing malware detection dataset download...")
        result = await manager._download_dataset("malware_detection", {
            "name": "Test Malware Dataset",
            "url": "https://raw.githubusercontent.com/Haggai-dev665/cybersecurity-datasets/main/malware_detection_sample.csv",
            "backup_urls": ["https://github.com/fabriceyhc/SilkRoad/raw/master/data/sr2_drugs_A_Z.csv"],
            "type": "malware",
            "samples": 1000,
            "features": ["file_hash", "file_size", "entropy", "pe_sections", "imports", "exports", "strings_count", "is_malware"]
        })
        
        if result:
            print("✅ Malware dataset download successful")
            
            # Test loading the dataset
            df = await manager.load_dataset("malware_detection")
            if df is not None:
                print(f"✅ Dataset loaded successfully: {len(df)} samples, {len(df.columns)} features")
                print(f"📊 Features: {list(df.columns)}")
                print(f"🎯 Sample data:\n{df.head()}")
            else:
                print("❌ Failed to load dataset")
        else:
            print("❌ Malware dataset download failed")
        
        print("\n2. Testing synthetic dataset generation for network intrusion...")
        result = await manager._download_dataset("network_intrusion", {
            "name": "Network Intrusion Dataset",
            "url": "https://nonexistent-url.com/data.csv",  # This will fail and trigger synthetic generation
            "backup_urls": ["https://another-nonexistent-url.com/data.csv"],
            "type": "network",
            "samples": 500,
            "features": ["duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes", "land", "wrong_fragment", "urgent"]
        })
        
        if result:
            print("✅ Network intrusion synthetic dataset created successfully")
            
            # Test loading the synthetic dataset
            df = await manager.load_dataset("network_intrusion")
            if df is not None:
                print(f"✅ Synthetic dataset loaded: {len(df)} samples, {len(df.columns)} features")
                print(f"📊 Features: {list(df.columns)}")
                print(f"🎯 Attack type distribution:\n{df['attack_type'].value_counts()}")
        else:
            print("❌ Network intrusion synthetic dataset creation failed")
        
        print("\n3. Testing complete dataset download pipeline...")
        download_results = await manager.download_cybersecurity_datasets()
        
        print(f"\n📋 Download Results:")
        print(f"   Total datasets: {download_results['total_datasets']}")
        print(f"   Successful downloads: {download_results['successful_downloads']}")
        print(f"   Failed downloads: {len(download_results['failed'])}")
        
        if download_results['downloaded']:
            print(f"\n✅ Successfully downloaded:")
            for dataset_id, info in download_results['downloaded'].items():
                print(f"   - {dataset_id}: {info['name']}")
        
        if download_results['failed']:
            print(f"\n❌ Failed to download:")
            for dataset_id, info in download_results['failed'].items():
                error_msg = info.get('error', 'Unknown error')
                print(f"   - {dataset_id}: {error_msg}")
        
        print("\n4. Testing dataset summaries...")
        available_datasets = manager.get_available_datasets()
        for dataset_id in list(available_datasets.keys())[:3]:  # Test first 3
            summary = await manager.get_dataset_summary(dataset_id)
            if summary:
                print(f"\n📊 {dataset_id} Summary:")
                print(f"   Rows: {summary['rows']}")
                print(f"   Columns: {summary['columns']}")
                print(f"   Memory usage: {summary['memory_usage']} bytes")
        
        print("\n🎉 Dataset manager testing completed!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_dataset_manager())
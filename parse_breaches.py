import os
import json
import re

def parse_breaches():
    breaches = []
    breaches_dir = "breaches"
    
    if not os.path.exists(breaches_dir):
        print(f"Error: Directory '{breaches_dir}' not found.")
        return
        
    filenames = os.listdir(breaches_dir)
    print(f"Found {len(filenames)} files in '{breaches_dir}' directory.")
    
    for filename in filenames:
        if not filename.endswith(".md"):
            continue
            
        filepath = os.path.join(breaches_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Parse title (usually # Heading)
        title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else filename[:-3]
        
        # Parse Description Section (between ## Description and ## Breached data)
        desc_section_match = re.search(
            r"## Description\s*\n\s*(.*?)\s*\n\s*## Breached data", 
            content, 
            re.DOTALL | re.IGNORECASE
        )
        description_raw = desc_section_match.group(1).strip() if desc_section_match else ""
        
        # Parse date and body from the description raw text
        lines = [line.strip() for line in description_raw.split("\n") if line.strip()]
        date_str = ""
        description_text = ""
        
        if lines:
            first_line = lines[0]
            # Match YYYY-MM-DD or YYYY-MM or YYYY
            if re.match(r"^\d{4}-\d{2}-\d{2}$", first_line) or re.match(r"^\d{4}-\d{2}$", first_line) or re.match(r"^\d{4}$", first_line):
                date_str = first_line
                description_text = "\n".join(lines[1:])
            else:
                description_text = "\n".join(lines)
        
        # Parse Breached Data Section (between ## Breached data and ## Free download Link or end)
        data_section_match = re.search(
            r"## Breached data\s*\n\s*(.*?)\s*\n\s*## Free download Link", 
            content, 
            re.DOTALL | re.IGNORECASE
        )
        if not data_section_match:
            # Fallback if "Free download Link" header is missing
            data_section_match = re.search(
                r"## Breached data\s*\n\s*(.*?)(?:\n\s*##|$)", 
                content, 
                re.DOTALL | re.IGNORECASE
            )
            
        breached_data_str = data_section_match.group(1).strip() if data_section_match else ""
        # Clean and split into list of strings
        if breached_data_str:
            breached_data = [item.strip() for item in breached_data_str.split(",") if item.strip()]
        else:
            breached_data = []
            
        # Parse Free Download Link Section
        download_section_match = re.search(
            r"## Free download Link\s*\n\s*(.*)$", 
            content, 
            re.DOTALL | re.IGNORECASE
        )
        download_str = download_section_match.group(1).strip() if download_section_match else ""
        
        download_text = ""
        download_link = ""
        if download_str:
            link_match = re.search(r"\[(.*?)\]\((.*?)\)", download_str)
            if link_match:
                download_text = link_match.group(1).strip()
                download_link = link_match.group(2).strip()
            else:
                # If it's a raw URL
                url_match = re.search(r"(https?://\S+)", download_str)
                if url_match:
                    download_link = url_match.group(1).strip()
                    download_text = "Download Link"
        
        breaches.append({
            "id": filename[:-3],
            "title": title,
            "date": date_str,
            "description": description_text,
            "breached_data": breached_data,
            "download_link": download_link,
            "download_text": download_text
        })
        
    # Sort breaches by date (descending, pushing empty dates to bottom)
    def get_sort_key(b):
        d = b["date"]
        if not d:
            return "0000-00-00"
        return d
        
    breaches.sort(key=get_sort_key, reverse=True)
    
    # Save to breaches.json
    output_path = "breaches.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(breaches, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully compiled {len(breaches)} breaches into '{output_path}'.")

if __name__ == "__main__":
    parse_breaches()

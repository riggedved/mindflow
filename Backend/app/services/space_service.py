"""
Intelligent Space Management Service
Handles AI-driven space creation, clustering, and suggestions
"""
from typing import List, Dict, Optional, Tuple
import numpy as np
import random
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, or_
from app.modals.space import Space
from app.modals.item import Item
from app.core.gemini_client import generate_content
import json


class SpaceService:
    """Service for intelligent space management"""
    
    # Similarity thresholds
    INITIAL_SIMILARITY_THRESHOLD = 0.75
    MIN_ITEMS_FOR_CLUSTER = 3
    MAX_ITEMS_FOR_CLUSTER = 50
    
    # Color palette for AI-generated spaces
    COLOR_PALETTE = [
        "#6366f1",  # Indigo
        "#8b5cf6",  # Purple
        "#ec4899",  # Pink
        "#f43f5e",  # Rose
        "#ef4444",  # Red
        "#f97316",  # Orange
        "#f59e0b",  # Amber
        "#eab308",  # Yellow
        "#84cc16",  # Lime
        "#22c55e",  # Green
        "#10b981",  # Emerald
        "#14b8a6",  # Teal
        "#06b6d4",  # Cyan
        "#0ea5e9",  # Sky
        "#3b82f6",  # Blue
        "#6366f1",  # Indigo (back to start)
    ]
    
    @staticmethod
    def get_random_color() -> str:
        """Get a random color from the palette"""
        return random.choice(SpaceService.COLOR_PALETTE)
    
    @staticmethod
    async def calculate_similarity(embedding1: List[float], embedding2: List[float]) -> float:
        """Calculate cosine similarity between two embeddings"""
        if not embedding1 or not embedding2:
            return 0.0
        
        vec1 = np.array(embedding1).reshape(1, -1)
        vec2 = np.array(embedding2).reshape(1, -1)
        return float(cosine_similarity(vec1, vec2)[0][0])
    
    @staticmethod
    async def find_best_space(
        item_embedding: List[float],
        user_id: int,
        db: AsyncSession
    ) -> Optional[Tuple[Space, float]]:
        """Find the best matching space for an item based on centroid similarity"""
        result = await db.execute(
            select(Space).where(
                and_(
                    Space.user_id == user_id,
                    Space.is_active == True,
                    Space.centroid_embedding.isnot(None)
                )
            )
        )
        spaces = result.scalars().all()
        
        best_space = None
        best_similarity = 0.0
        
        for space in spaces:
            similarity = await SpaceService.calculate_similarity(
                item_embedding,
                space.centroid_embedding
            )
            
            if similarity > best_similarity and similarity >= space.similarity_threshold:
                best_space = space
                best_similarity = similarity
        
        return (best_space, best_similarity) if best_space else None
    
    @staticmethod
    async def assign_item_to_space(
        item: Item,
        space: Space,
        db: AsyncSession
    ) -> None:
        """Assign an item to a space and update space centroid"""
        item.space_id = space.id
        
        # Update space item count
        space.item_count += 1
        
        # Recalculate centroid
        await SpaceService.update_space_centroid(space, db)
        
        await db.commit()
    
    @staticmethod
    async def update_space_centroid(space: Space, db: AsyncSession) -> None:
        """Recalculate the centroid embedding of a space"""
        result = await db.execute(
            select(Item).where(
                and_(
                    Item.space_id == space.id,
                    Item.ai_meta["embedding"].astext.isnot(None)
                )
            )
        )
        items = result.scalars().all()
        
        if not items:
            space.centroid_embedding = None
            return
        
        # Extract embeddings
        embeddings = []
        for item in items:
            if item.ai_meta and "embedding" in item.ai_meta:
                embeddings.append(item.ai_meta["embedding"])
        
        if embeddings:
            # Calculate average (centroid)
            centroid = np.mean(embeddings, axis=0).tolist()
            space.centroid_embedding = centroid
    
    @staticmethod
    async def detect_new_clusters(
        user_id: int,
        db: AsyncSession
    ) -> List[Dict]:
        """Detect potential new spaces from unclustered items"""
        # Get unclustered items (items without space_id)
        result = await db.execute(
            select(Item).where(
                and_(
                    Item.user_id == user_id,
                    Item.space_id.is_(None),
                    Item.ai_meta["embedding"].astext.isnot(None)
                )
            )
        )
        unclustered_items = result.scalars().all()
        
        if len(unclustered_items) < SpaceService.MIN_ITEMS_FOR_CLUSTER:
            return []
        
        # Extract embeddings and item IDs
        embeddings = []
        item_ids = []
        items_map = {}
        
        for item in unclustered_items:
            if item.ai_meta and "embedding" in item.ai_meta:
                embeddings.append(item.ai_meta["embedding"])
                item_ids.append(item.id)
                items_map[item.id] = item
        
        if len(embeddings) < SpaceService.MIN_ITEMS_FOR_CLUSTER:
            return []
        
        # Use DBSCAN clustering
        embeddings_array = np.array(embeddings)
        clustering = DBSCAN(eps=0.3, min_samples=SpaceService.MIN_ITEMS_FOR_CLUSTER, metric='cosine')
        labels = clustering.fit_predict(embeddings_array)
        
        # Group items by cluster
        clusters = {}
        for idx, label in enumerate(labels):
            if label == -1:  # Noise points
                continue
            
            if label not in clusters:
                clusters[label] = []
            
            clusters[label].append(item_ids[idx])
        
        # Generate suggestions for each cluster
        suggestions = []
        for cluster_label, cluster_item_ids in clusters.items():
            if len(cluster_item_ids) < SpaceService.MIN_ITEMS_FOR_CLUSTER:
                continue
            
            cluster_items = [items_map[item_id] for item_id in cluster_item_ids]
            suggestion = await SpaceService.generate_space_suggestion(cluster_items)
            
            if suggestion:
                suggestion["item_ids"] = cluster_item_ids
                suggestion["item_count"] = len(cluster_item_ids)
                suggestions.append(suggestion)
        
        return suggestions
    
    @staticmethod
    async def generate_space_suggestion(items: List[Item]) -> Optional[Dict]:
        """Generate a space suggestion based on a cluster of items"""
        # Collect item information
        titles = [item.title for item in items if item.title]
        tags = []
        for item in items:
            if item.tags:
                tags.extend(item.tags)
        
        # Create context for AI
        context = {
            "titles": titles[:10],  # Limit to 10 titles
            "common_tags": list(set(tags))[:15],  # Top 15 unique tags
            "item_count": len(items)
        }
        
        prompt = f"""
Based on these items, suggest a name for a new organizational space:

Titles: {', '.join(context['titles'])}
Common tags: {', '.join(context['common_tags'])}
Item count: {context['item_count']}

Generate a JSON response with:
- name: A concise, descriptive name (2-4 words)
- description: A brief explanation (one sentence)
- icon: Suggest one of these icons: Sparkles, Folder, Lightbulb, Bookmark, Image, Video, Code, Book, Music, Heart, Star, Zap, Target, TrendingUp

Respond ONLY with valid JSON, no markdown. Do NOT include a color field.
"""
        
        try:
            response = await generate_content(prompt)
            
            # Clean response (remove markdown code blocks if present)
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()
            
            suggestion = json.loads(response)
            # Add random color to suggestion
            suggestion["color"] = SpaceService.get_random_color()
            return suggestion
        except Exception as e:
            print(f"Error generating space suggestion: {e}")
            return None
    
    @staticmethod
    async def create_space_from_suggestion(
        suggestion: Dict,
        item_ids: List[int],
        user_id: int,
        db: AsyncSession
    ) -> Space:
        """Create a new space from an AI suggestion and assign items"""
        # Create the space
        new_space = Space(
            user_id=user_id,
            name=suggestion.get("name", "New Space"),
            description=suggestion.get("description", ""),
            color=suggestion.get("color", "#6366f1"),
            icon=suggestion.get("icon", "Folder"),
            is_suggested=True,
            is_active=True,
            item_count=0,
            similarity_threshold=SpaceService.INITIAL_SIMILARITY_THRESHOLD,
            space_metadata={
                "created_from_suggestion": True,
                "original_item_count": len(item_ids)
            }
        )
        
        db.add(new_space)
        await db.flush()  # Get the space ID
        
        # Assign items to the space
        result = await db.execute(
            select(Item).where(Item.id.in_(item_ids))
        )
        items = result.scalars().all()
        
        for item in items:
            item.space_id = new_space.id
            new_space.item_count += 1
        
        # Calculate initial centroid
        await SpaceService.update_space_centroid(new_space, db)
        
        await db.commit()
        await db.refresh(new_space)
        
        return new_space
    
    @staticmethod
    async def reject_suggestion(
        user_id: int,
        item_ids: List[int],
        db: AsyncSession
    ) -> None:
        """Learn from rejected suggestion by increasing similarity threshold"""
        # Get all user's spaces and slightly increase their thresholds
        result = await db.execute(
            select(Space).where(
                and_(
                    Space.user_id == user_id,
                    Space.is_active == True
                )
            )
        )
        spaces = result.scalars().all()
        
        for space in spaces:
            # Increase threshold slightly (more conservative)
            if space.similarity_threshold < 0.9:
                space.similarity_threshold = min(0.9, space.similarity_threshold + 0.02)
            
            if not space.space_metadata:
                space.space_metadata = {}
            
            if "rejections" not in space.space_metadata:
                space.space_metadata["rejections"] = 0
            
            space.space_metadata["rejections"] += 1
        
        await db.commit()

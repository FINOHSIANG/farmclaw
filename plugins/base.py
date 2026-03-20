from abc import ABC, abstractmethod
from typing import Any, Dict

class BasePlugin(ABC):
    """
    Base class for all FARMCLAW plugins.
    Every plugin represents a 'tool' or 'sensory organ' for the agricultural agent.
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the plugin."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Description of what the plugin does, to be used by the LLM."""
        pass

    @abstractmethod
    def execute(self, **kwargs) -> Dict[str, Any]:
        """
        Execute the plugin's action.
        Returns a dictionary containing the result, which will be fed back to the LLM.
        """
        pass

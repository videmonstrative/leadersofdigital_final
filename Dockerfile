FROM mcr.microsoft.com/dotnet/core/aspnet:3.1
WORKDIR /app
COPY ./ /app
ENTRYPOINT ["dotnet", "/app/bin/Release/netcoreapp3.1/aspnet.dll"]